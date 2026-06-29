const pool = require('../db/pool');

async function createUser({ username, email, passwordHash, avatar }) {
  const [result] = await pool.query(
    'INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)',
    [username, email, passwordHash, avatar || '🌸']
  );
  return result.insertId;
}

async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function findByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function updatePassword(userId, passwordHash) {
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

async function updateProfile(userId, { username, avatar }) {
  await pool.query('UPDATE users SET username = ?, avatar = ? WHERE id = ?', [username, avatar, userId]);
}

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.created_at,
  };
}

module.exports = {
  createUser,
  findByEmail,
  findByUsername,
  findById,
  updatePassword,
  updateProfile,
  toPublicUser,
};
