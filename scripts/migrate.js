/**
 * Crée (ou met à jour) toutes les tables de la base de données.
 * Sûr à relancer à tout moment (CREATE TABLE IF NOT EXISTS).
 *
 * Usage : node scripts/migrate.js
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../db/pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

  // Retire les lignes de commentaire, puis découpe en instructions individuelles
  const cleanSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Exécution de ${statements.length} instruction(s) SQL...`);

  for (const statement of statements) {
    await pool.query(statement);
  }

  console.log('✓ Migration terminée — toutes les tables sont prêtes.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('✗ Échec de la migration :', err.message);
  process.exit(1);
});
