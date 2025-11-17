const db = require('../config/db');

const Devices = {
  createPending: async (phone) => {
    const now = new Date();
    const sql = `INSERT INTO devices (phone, status, created_at, updated_at) VALUES (?, 'pending', ?, ?)`;
    const [r] = await db.execute(sql, [phone, now, now]);
    return { id: r.insertId };
  },
  markActive: async (id, profile = {}) => {
    const now = new Date();
    const sql = `UPDATE devices SET status='active', username=?, display_name=?, updated_at=? WHERE id=?`;
    const params = [profile.username || null, profile.display_name || null, now, id];
    const [r] = await db.execute(sql, params);
    return r;
  },
  markInactive: async (id) => {
    const now = new Date();
    const sql = `UPDATE devices SET status='inactive', updated_at=? WHERE id=?`;
    const [r] = await db.execute(sql, [now, id]);
    return r;
  },
  markRevoked: async (id) => {
    const now = new Date();
    const sql = `UPDATE devices SET status='revoked', updated_at=? WHERE id=?`;
    const [r] = await db.execute(sql, [now, id]);
    return r;
  },
  updateLastSeen: async (id) => {
    const now = new Date();
    const sql = `UPDATE devices SET last_seen_at=?, updated_at=? WHERE id=?`;
    const [r] = await db.execute(sql, [now, now, id]);
    return r;
  },
  list: async () => {
    const [rows] = await db.execute(`SELECT * FROM devices ORDER BY id DESC`);
    return rows;
  },
  getById: async (id) => {
    const [rows] = await db.execute(`SELECT * FROM devices WHERE id=?`, [id]);
    return rows[0] || null;
  },
  delete: async (id) => {
    const [r] = await db.execute(`DELETE FROM devices WHERE id=?`, [id]);
    return r;
  }
};

module.exports = Devices;

