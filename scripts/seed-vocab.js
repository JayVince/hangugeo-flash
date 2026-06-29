/**
 * Insère le vocabulaire (data/vocab.json) dans la table `vocab`.
 * Sûr à relancer : les mots déjà présents (même hangeul) sont ignorés.
 *
 * Usage : node scripts/seed-vocab.js
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../db/pool');

async function seed() {
  const vocab = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'vocab.json'), 'utf8')
  );

  let inserted = 0;
  let skipped  = 0;

  for (const word of vocab) {
    const [result] = await pool.query(
      `INSERT INTO vocab (id, hangeul, romanisation, translation, category)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         romanisation = VALUES(romanisation),
         translation  = VALUES(translation),
         category     = VALUES(category)`,
      [word.id, word.hangeul, word.romanisation, word.translation, word.category]
    );
    if (result.affectedRows === 1) inserted++;
    else skipped++; // déjà présent, mis à jour si besoin
  }

  console.log(`✓ Vocabulaire synchronisé : ${inserted} insertions, ${skipped} déjà présents/mis à jour.`);

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM vocab');
  console.log(`Total de mots en base : ${total}`);

  await pool.end();
}

seed().catch((err) => {
  console.error('✗ Échec du seed :', err.message);
  process.exit(1);
});
