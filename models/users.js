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
    role: user.role,
    isActive: !!user.is_active,
    createdAt: user.created_at,
  };
}

// ══════════════════════════════════════════════════════
//  Fonctions administrateur
// ══════════════════════════════════════════════════════

async function listUsers({ search = '', page = 1, pageSize = 20 } = {}) {
  const offset = (page - 1) * pageSize;
  const like = `%${search}%`;

  const [rows] = await pool.query(
    `SELECT id, username, email, avatar, role, is_active, created_at
     FROM users
     WHERE username LIKE ? OR email LIKE ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [like, like, pageSize, offset]
  );

  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM users WHERE username LIKE ? OR email LIKE ?',
    [like, like]
  );

  return {
    users: rows.map(toPublicUser),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Fiche détaillée : profil + statistiques d'apprentissage
async function getUserDetails(userId) {
  const user = await findById(userId);
  if (!user) return null;

  const [[masteredRow]] = await pool.query(
    "SELECT COUNT(*) AS count FROM user_progress WHERE user_id = ? AND last_action = 'mastered'",
    [userId]
  );
  const [[reviewRow]] = await pool.query(
    "SELECT COUNT(*) AS count FROM user_progress WHERE user_id = ? AND last_action = 'review'",
    [userId]
  );
  const [[customCardsRow]] = await pool.query(
    'SELECT COUNT(*) AS count FROM custom_cards WHERE user_id = ?',
    [userId]
  );
  const [[quizRow]] = await pool.query(
    'SELECT COUNT(*) AS count, AVG(score / total) AS avgRatio FROM quiz_history WHERE user_id = ?',
    [userId]
  );
  const [streakRows] = await pool.query(
    'SELECT current_streak AS current, longest_streak AS longest FROM user_streaks WHERE user_id = ?',
    [userId]
  );

  return {
    user: toPublicUser(user),
    stats: {
      masteredCount: masteredRow.count,
      reviewCount: reviewRow.count,
      customCardsCount: customCardsRow.count,
      quizSessionsCount: quizRow.count,
      quizAverageScore: quizRow.avgRatio ? Math.round(quizRow.avgRatio * 100) : null,
      streak: streakRows[0] || { current: 0, longest: 0 },
    },
  };
}

async function adminUpdateProfile(userId, { username, email, avatar }) {
  await pool.query(
    'UPDATE users SET username = ?, email = ?, avatar = ? WHERE id = ?',
    [username, email, avatar, userId]
  );
}

async function setActive(userId, isActive) {
  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, userId]);
}

async function setRole(userId, role) {
  await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
}

async function deleteUser(userId) {
  // Les tables liées (progress, custom_cards, quiz_history, streaks,
  // password_resets) sont supprimées automatiquement via ON DELETE CASCADE.
  const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  return result.affectedRows > 0;
}

async function countAdmins() {
  const [[{ count }]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
  return count;
}

async function getDashboardStats() {
  const [[totalUsersRow]] = await pool.query('SELECT COUNT(*) AS count FROM users');
  const [[totalCardsRow]] = await pool.query('SELECT COUNT(*) AS count FROM custom_cards');
  const [[totalQuizRow]] = await pool.query('SELECT COUNT(*) AS count FROM quiz_history');
  const [[totalVocabRow]] = await pool.query('SELECT COUNT(*) AS count FROM vocab');
  const [[activeUsersRow]] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE is_active = 1');

  // Nouveaux comptes par jour, 14 derniers jours
  const [signupsByDay] = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM users
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  return {
    totalUsers: totalUsersRow.count,
    activeUsers: activeUsersRow.count,
    totalCustomCards: totalCardsRow.count,
    totalQuizSessions: totalQuizRow.count,
    totalVocabWords: totalVocabRow.count,
    signupsByDay: signupsByDay.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
      count: r.count,
    })),
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
  listUsers,
  getUserDetails,
  adminUpdateProfile,
  setActive,
  setRole,
  deleteUser,
  countAdmins,
  getDashboardStats,
};
