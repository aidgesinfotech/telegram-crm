const db = require('../config/db');

const DeviceSessions = {
  insert: async (deviceId, session_data_b64) => {
    const now = new Date();
    const sql = `INSERT INTO device_sessions (device_id, session_data, is_primary, created_at) VALUES (?, ?, 1, ?)`;
    const [r] = await db.execute(sql, [deviceId, session_data_b64, now]);
    return { id: r.insertId };
  },
  updatePrimary: async (deviceId, session_data_b64) => {
    const now = new Date();
    const [rows] = await db.execute(`SELECT id FROM device_sessions WHERE device_id=? AND is_primary=1 ORDER BY id DESC LIMIT 1`, [deviceId]);
    if (rows.length) {
      const sql = `UPDATE device_sessions SET session_data=?, created_at=? WHERE id=?`;
      await db.execute(sql, [session_data_b64, now, rows[0].id]);
      return { id: rows[0].id };
    }
    return await DeviceSessions.insert(deviceId, session_data_b64);
  },
  getPrimary: async (deviceId) => {
    const [rows] = await db.execute(`SELECT * FROM device_sessions WHERE device_id=? AND is_primary=1 ORDER BY id DESC LIMIT 1`, [deviceId]);
    return rows[0] || null;
  },
  deleteByDevice: async (deviceId) => {
    const [r] = await db.execute(`DELETE FROM device_sessions WHERE device_id=?`, [deviceId]);
    return r;
  }
};

module.exports = DeviceSessions;

