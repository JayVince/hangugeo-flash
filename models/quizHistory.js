const pool = require('../db/pool');

const MAX_HISTORY = 20;

async function addQuizResult(userId, { score, total, mode, category }) {
  await pool.query(
    'INSERT INTO quiz_history (user_id, score, total, mode, category) VALUES (?, ?, ?, ?, ?)',
    [userId, score, total, mode, category || 'all']
  );

  // Garde uniquement les MAX_HISTORY dernières sessions (purge des plus anciennes)
  await pool.query(
    `DELETE FROM quiz_history WHERE user_id = ? AND id NOT IN (
       SELECT id FROM (
         SELECT id FROM quiz_history WHERE user_id = ? ORDER BY played_at DESC LIMIT ?
       ) AS recent
     )`,
    [userId, userId, MAX_HISTORY]
  );
}

async function getHistory(userId) {
  const [rows] = await pool.query(
    'SELECT score, total, mode, category, played_at AS playedAt FROM quiz_history WHERE user_id = ? ORDER BY played_at DESC LIMIT ?',
    [userId, MAX_HISTORY]
  );
  return rows;
}

module.exports = { addQuizResult, getHistory };
