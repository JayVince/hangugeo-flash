const pool = require('../db/pool');

const LEITNER_INTERVALS = [0, 1, 3, 7, 14]; // jours, par niveau de boîte (1 à 5)

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function getProgressByUser(userId) {
  const [rows] = await pool.query(
    'SELECT card_type AS cardType, card_id AS cardId, box, last_action AS lastAction, next_review AS nextReview FROM user_progress WHERE user_id = ?',
    [userId]
  );
  // next_review revient en objet Date depuis MySQL — on le normalise en chaîne YYYY-MM-DD
  return rows.map((r) => ({
    ...r,
    nextReview: r.nextReview instanceof Date ? r.nextReview.toISOString().slice(0, 10) : r.nextReview,
  }));
}

/**
 * Marque une carte comme "mastered" ou "review" pour un utilisateur.
 * Centralise la même logique Leitner que l'ancienne version client
 * (corrigée : lastAction pilote l'affichage, box pilote uniquement le
 * tri "cartes dues en premier").
 */
async function markCard(userId, cardType, cardId, action) {
  const [existingRows] = await pool.query(
    'SELECT box FROM user_progress WHERE user_id = ? AND card_type = ? AND card_id = ?',
    [userId, cardType, cardId]
  );
  const currentBox = existingRows[0] ? existingRows[0].box : 1;

  const newBox = action === 'mastered' ? Math.min(5, currentBox + 1) : 1;
  const nextReview = addDays(todayStr(), LEITNER_INTERVALS[newBox - 1]);

  await pool.query(
    `INSERT INTO user_progress (user_id, card_type, card_id, box, last_action, next_review)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE box = ?, last_action = ?, next_review = ?`,
    [userId, cardType, cardId, newBox, action, nextReview, newBox, action, nextReview]
  );

  return { box: newBox, lastAction: action, nextReview };
}

// Supprime la progression liée à une carte personnalisée supprimée
async function deleteProgressForCard(userId, cardType, cardId) {
  await pool.query(
    'DELETE FROM user_progress WHERE user_id = ? AND card_type = ? AND card_id = ?',
    [userId, cardType, cardId]
  );
}

module.exports = { getProgressByUser, markCard, deleteProgressForCard, todayStr };
