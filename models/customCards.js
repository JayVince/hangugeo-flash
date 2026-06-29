const pool = require('../db/pool');

async function getCardsByUser(userId) {
  const [rows] = await pool.query(
    'SELECT id, hangeul, romanisation, translation FROM custom_cards WHERE user_id = ? ORDER BY id',
    [userId]
  );
  return rows;
}

async function createCard(userId, { hangeul, romanisation, translation }) {
  const [result] = await pool.query(
    'INSERT INTO custom_cards (user_id, hangeul, romanisation, translation) VALUES (?, ?, ?, ?)',
    [userId, hangeul, romanisation, translation]
  );
  return result.insertId;
}

// Met à jour une carte, uniquement si elle appartient bien à l'utilisateur
async function updateCard(userId, cardId, { hangeul, romanisation, translation }) {
  const [result] = await pool.query(
    'UPDATE custom_cards SET hangeul = ?, romanisation = ?, translation = ? WHERE id = ? AND user_id = ?',
    [hangeul, romanisation, translation, cardId, userId]
  );
  return result.affectedRows > 0;
}

async function deleteCard(userId, cardId) {
  const [result] = await pool.query(
    'DELETE FROM custom_cards WHERE id = ? AND user_id = ?',
    [cardId, userId]
  );
  return result.affectedRows > 0;
}

module.exports = { getCardsByUser, createCard, updateCard, deleteCard };
