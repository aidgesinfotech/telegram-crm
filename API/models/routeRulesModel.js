const db = require('../config/db');

const RouteRules = {
  ensureTable: async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS route_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id INT NOT NULL,
      source_chat_id BIGINT NOT NULL,
      bot_id INT NOT NULL,
      dest_chat_id BIGINT NOT NULL,
      title VARCHAR(255) NULL,
      filters_json JSON NULL,
      transforms_json JSON NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    // Backward compatible: add title column if missing
    try{ await db.execute('ALTER TABLE route_rules ADD COLUMN title VARCHAR(255) NULL'); }catch(_e){}
  },
  create: async (rule) => {
    await RouteRules.ensureTable();
    const sql = `INSERT INTO route_rules (device_id, source_chat_id, bot_id, dest_chat_id, title, filters_json, transforms_json, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [rule.device_id, rule.source_chat_id, rule.bot_id, rule.dest_chat_id, rule.title || null, JSON.stringify(rule.filters_json||null), JSON.stringify(rule.transforms_json||null), rule.enabled?1:0];
    const [r] = await db.execute(sql, params);
    return { id: r.insertId };
  },
  listByDevice: async (device_id) => {
    await RouteRules.ensureTable();
    const [rows] = await db.execute(`SELECT * FROM route_rules WHERE device_id=? ORDER BY id DESC`, [device_id]);
    return rows;
  },
  getById: async (id) => {
    await RouteRules.ensureTable();
    const [rows] = await db.execute(`SELECT * FROM route_rules WHERE id=?`, [id]);
    return rows[0] || null;
  },
  update: async (id, patch) => {
    await RouteRules.ensureTable();
    const fields = [];
    const params = [];
    if (patch.source_chat_id !== undefined){ fields.push('source_chat_id=?'); params.push(patch.source_chat_id); }
    if (patch.bot_id !== undefined){ fields.push('bot_id=?'); params.push(patch.bot_id); }
    if (patch.dest_chat_id !== undefined){ fields.push('dest_chat_id=?'); params.push(patch.dest_chat_id); }
    if (patch.title !== undefined){ fields.push('title=?'); params.push(patch.title || null); }
    if (patch.filters_json !== undefined){ fields.push('filters_json=?'); params.push(JSON.stringify(patch.filters_json)); }
    if (patch.transforms_json !== undefined){ fields.push('transforms_json=?'); params.push(JSON.stringify(patch.transforms_json)); }
    if (patch.enabled !== undefined){ fields.push('enabled=?'); params.push(patch.enabled?1:0); }
    if (!fields.length) return { affectedRows: 0 };
    const sql = `UPDATE route_rules SET ${fields.join(', ')} WHERE id=?`;
    params.push(id);
    const [r] = await db.execute(sql, params);
    return r;
  },
  delete: async (id) => {
    await RouteRules.ensureTable();
    const [r] = await db.execute(`DELETE FROM route_rules WHERE id=?`, [id]);
    return r;
  },
  listActiveForSource: async (device_id, source_chat_id) => {
    await RouteRules.ensureTable();
    const [rows] = await db.execute(`SELECT * FROM route_rules WHERE device_id=? AND source_chat_id=? AND enabled=1`, [device_id, source_chat_id]);
    return rows;
  },
  disableByDest: async (bot_id, dest_chat_id) => {
    await RouteRules.ensureTable();
    const [r] = await db.execute(`UPDATE route_rules SET enabled=0 WHERE bot_id=? AND dest_chat_id=?`, [bot_id, dest_chat_id]);
    return r;
  },
  disableBySource: async (device_id, source_chat_id) => {
    await RouteRules.ensureTable();
    const [r] = await db.execute(`UPDATE route_rules SET enabled=0 WHERE device_id=? AND source_chat_id=?`, [device_id, source_chat_id]);
    return r;
  }
};

module.exports = RouteRules;
