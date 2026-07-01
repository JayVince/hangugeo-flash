const pool = require('../db/pool');

async function logAction(adminId, action, targetType, targetId, details) {
  await pool.query(
    'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
    [adminId, action, targetType, targetId != null ? String(targetId) : null, details ? JSON.stringify(details) : null]
  );
}

async function getLog({ page = 1, pageSize = 30 } = {}) {
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
    `SELECT l.id, l.action, l.target_type AS targetType, l.target_id AS targetId,
            l.details, l.created_at AS createdAt,
            u.username AS adminUsername
     FROM admin_audit_log l
     JOIN users u ON u.id = l.admin_id
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM admin_audit_log');

  return {
    entries: rows.map((r) => ({
      ...r,
      details: r.details ? JSON.parse(r.details) : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

module.exports = { logAction, getLog };
