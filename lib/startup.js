/**
 * Auto-migration et auto-seed au démarrage du serveur.
 *
 * Exécuté une seule fois avant que le serveur n'accepte des connexions.
 * Entièrement idempotent :
 *   - CREATE TABLE IF NOT EXISTS → sans effet si les tables existent déjà
 *   - ALTER TABLE (colonnes ajoutées une à une, avec vérification
 *     préalable dans information_schema) → sans effet si déjà présentes
 *   - INSERT ... ON DUPLICATE KEY UPDATE → sans effet si les mots existent
 *
 * Avantage : aucune commande manuelle (npm run migrate / seed-vocab) à
 * exécuter en SSH — le serveur se configure tout seul à son démarrage,
 * même sur des hébergements où l'accès SSH à Node.js est restreint
 * (ex. Hostinger avec CageFS), et même pour ajouter des colonnes à des
 * tables déjà existantes en production (CREATE TABLE IF NOT EXISTS seul
 * ne suffit pas dans ce cas).
 */

const fs   = require('fs');
const path = require('path');
const pool = require('../db/pool');

// ── Migration (création des tables) ─────────────────────

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }

  console.log(`✓ Migration : ${statements.length} instruction(s) SQL exécutée(s).`);
}

// ── Migration incrémentale (colonnes ajoutées à des tables existantes) ──

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function migrateColumns() {
  const additions = [
    { table: 'users', column: 'role',      ddl: "ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user'" },
    { table: 'users', column: 'is_active', ddl: 'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1' },
  ];

  for (const { table, column, ddl } of additions) {
    const exists = await columnExists(table, column);
    if (!exists) {
      await pool.query(ddl);
      console.log(`✓ Colonne ajoutée : ${table}.${column}`);
    }
  }
}

// ── Bootstrap du premier administrateur ──────────────────
//
// Définissez ADMIN_BOOTSTRAP_EMAIL dans les variables d'environnement
// avec l'e-mail d'un compte déjà inscrit pour le promouvoir admin au
// prochain démarrage. Sûr à laisser en place (idempotent), mais il est
// recommandé de retirer la variable une fois le premier admin créé,
// pour éviter qu'un autre admin puisse être re-promu malgré une
// rétrogradation volontaire faite depuis le panneau.

async function bootstrapAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  if (!email) return;

  const [rows] = await pool.query('SELECT id, role FROM users WHERE email = ? LIMIT 1', [email]);
  if (rows.length === 0) {
    console.log(`⚠ ADMIN_BOOTSTRAP_EMAIL défini (${email}) mais aucun compte associé — inscrivez-vous d'abord, puis redémarrez.`);
    return;
  }

  if (rows[0].role === 'admin') return; // déjà admin, rien à faire

  await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [rows[0].id]);
  console.log(`✓ Compte promu administrateur : ${email}`);
}

// ── Seed (vocabulaire) ────────────────────────────────────

async function seedVocab() {
  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM vocab');

  if (count > 0) {
    console.log(`✓ Vocabulaire : ${count} mots déjà en base (seed ignoré).`);
    return;
  }

  const vocab = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'vocab.json'), 'utf8')
  );

  for (const word of vocab) {
    await pool.query(
      `INSERT INTO vocab (id, hangeul, romanisation, translation, category)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         romanisation = VALUES(romanisation),
         translation  = VALUES(translation),
         category     = VALUES(category)`,
      [word.id, word.hangeul, word.romanisation, word.translation, word.category]
    );
  }

  console.log(`✓ Vocabulaire : ${vocab.length} mots insérés.`);
}

// ── Point d'entrée ────────────────────────────────────────

async function runStartup() {
  console.log('🔧 Initialisation de la base de données...');

  try {
    await migrate();
    await migrateColumns();
    await bootstrapAdmin();
    await seedVocab();
    console.log('✓ Base de données prête.');
  } catch (err) {
    console.error('✗ Échec de l\'initialisation de la base :', err.message);
  }
}

module.exports = runStartup;
