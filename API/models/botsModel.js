const db = require('../config/db');

const Bots = {
  create: async (data) => {
    const sql = `INSERT INTO bots (name, username, token, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`;
    const params = [data.name, data.username || null, data.token, data.is_active ? 1 : 0];
    const [results] = await db.execute(sql, params);
    return { status: 'success', data: results };
  },
  getAll: async () => {
    const [results] = await db.execute(`SELECT * FROM bots ORDER BY created_at DESC`);
    return { status: 'success', data: results };
  },
  update: async (id, data) => {
    const sql = `UPDATE bots SET name = ?, username = ?, token = ?, is_active = ?, updated_at = NOW() WHERE id = ?`;
    const params = [data.name, data.username || null, data.token, data.is_active ? 1 : 0, id];
    const [results] = await db.execute(sql, params);
    return { status: 'success', data: results };
  },
  delete: async (id) => {
    const [results] = await db.execute(`DELETE FROM bots WHERE id = ?`, [id]);
    return { status: 'success', data: results };
  },
  getActiveBots: async () => {
    const [results] = await db.execute(`SELECT * FROM bots WHERE is_active = 1`);
    return results;
  },
  getById: async (id) => {
    const [results] = await db.execute(`SELECT * FROM bots WHERE id = ?`, [id]);
    return results[0] || null;
  },
  getByUsername: async (username) => {
    const [results] = await db.execute(`SELECT * FROM bots WHERE username = ?`, [username]);
    return results[0] || null;
  }
};

module.exports = Bots;
