const pool = require('../db/pool');

async function getAllVocab() {
  const [rows] = await pool.query('SELECT id, hangeul, romanisation, translation, category FROM vocab ORDER BY id');
  return rows;
}

module.exports = { getAllVocab };
