/**
 * Auto-migration et auto-seed au démarrage du serveur.
 *
 * Exécuté une seule fois avant que le serveur n'accepte des connexions.
 * Entièrement idempotent :
 *   - CREATE TABLE IF NOT EXISTS → sans effet si les tables existent déjà
 *   - INSERT ... ON DUPLICATE KEY UPDATE → sans effet si les mots existent
 *
 * Avantage : aucune commande manuelle (npm run migrate / seed-vocab) à
 * exécuter en SSH — le serveur se configure tout seul à son premier
 * démarrage, même sur des hébergements où l'accès SSH à Node.js est
 * restreint (ex. Hostinger avec CageFS).
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
    await seedVocab();
    console.log('✓ Base de données prête.');
  } catch (err) {
    console.error('✗ Échec de l\'initialisation de la base :', err.message);
    // On ne plante pas le serveur — l'app reste accessible et l'erreur
    // est journalisée pour diagnostic (ex. mauvaises variables d'env).
  }
}

module.exports = runStartup;
