const crypto = require('crypto');
const pool   = require('../db/pool');

const TOKEN_VALIDITY_MS = 60 * 60 * 1000; // 1 heure

// Génère un jeton aléatoire — la version brute est envoyée par e-mail,
// seul son hachage SHA-256 est stocké en base (comme une "preuve de
// connaissance" sans jamais garder le secret en clair côté serveur).
async function createResetToken(userId) {
  const rawToken  = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + TOKEN_VALIDITY_MS);

  await pool.query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
}

async function findValidToken(rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const [rows] = await pool.query(
    `SELECT * FROM password_resets
     WHERE token_hash = ? AND used = 0 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function markTokenUsed(id) {
  await pool.query('UPDATE password_resets SET used = 1 WHERE id = ?', [id]);
}

module.exports = { createResetToken, findValidToken, markTokenUsed };
