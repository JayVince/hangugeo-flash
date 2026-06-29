const pool = require('../db/pool');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function getStreak(userId) {
  const [rows] = await pool.query(
    'SELECT current_streak AS current, longest_streak AS longest, last_active_date AS lastDate FROM user_streaks WHERE user_id = ?',
    [userId]
  );
  if (!rows[0]) return { current: 0, longest: 0, lastDate: null };
  return {
    current: rows[0].current,
    longest: rows[0].longest,
    lastDate: rows[0].lastDate instanceof Date ? rows[0].lastDate.toISOString().slice(0, 10) : rows[0].lastDate,
  };
}

// Appelée chaque fois qu'une activité d'apprentissage a lieu (carte
// marquée, quiz terminé). Incrémente la série une seule fois par jour.
async function recordActivity(userId) {
  const today = todayStr();
  const streak = await getStreak(userId);

  if (streak.lastDate === today) return streak; // déjà comptabilisé aujourd'hui

  const yesterday = addDays(today, -1);
  const newCurrent = streak.lastDate === yesterday ? streak.current + 1 : 1;
  const newLongest = Math.max(streak.longest, newCurrent);

  await pool.query(
    `INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE current_streak = ?, longest_streak = ?, last_active_date = ?`,
    [userId, newCurrent, newLongest, today, newCurrent, newLongest, today]
  );

  return { current: newCurrent, longest: newLongest, lastDate: today };
}

module.exports = { getStreak, recordActivity };
