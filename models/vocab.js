const pool = require('../db/pool');

async function getAllVocab() {
  const [rows] = await pool.query('SELECT id, hangeul, romanisation, translation, category FROM vocab ORDER BY id');
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query('SELECT id, hangeul, romanisation, translation, category FROM vocab WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Lève une erreur avec err.code === 'ER_DUP_ENTRY' si le hangeul existe déjà
// (contrainte UNIQUE en base — voir db/schema.sql) ; à traiter côté route.
async function createWord({ hangeul, romanisation, translation, category }) {
  const [result] = await pool.query(
    'INSERT INTO vocab (hangeul, romanisation, translation, category) VALUES (?, ?, ?, ?)',
    [hangeul, romanisation, translation, category]
  );
  return result.insertId;
}

async function updateWord(id, { hangeul, romanisation, translation, category }) {
  const [result] = await pool.query(
    'UPDATE vocab SET hangeul = ?, romanisation = ?, translation = ?, category = ? WHERE id = ?',
    [hangeul, romanisation, translation, category, id]
  );
  return result.affectedRows > 0;
}

async function deleteWord(id) {
  const [result] = await pool.query('DELETE FROM vocab WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { getAllVocab, getById, createWord, updateWord, deleteWord };
