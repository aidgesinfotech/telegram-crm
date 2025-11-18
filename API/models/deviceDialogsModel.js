const db = require('../config/db');

// Ensure tables exist
async function ensureTables(){
  await db.execute(`CREATE TABLE IF NOT EXISTS device_dialogs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    peer_id BIGINT NOT NULL,
    title VARCHAR(255) NULL,
    type VARCHAR(16) NULL,
    username VARCHAR(255) NULL,
    deleted TINYINT DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_device_peer (device_id, peer_id)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS device_dialogs_sync (
    device_id INT PRIMARY KEY,
    synced_at DATETIME NOT NULL
  )`);
}

const DeviceDialogs = {
  ensure: ensureTables,

  upsertMany: async (deviceId, items) => {
    if (!Array.isArray(items) || !items.length) return 0;
    const now = new Date();
    const sql = `INSERT INTO device_dialogs (device_id, peer_id, title, type, username, deleted, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                 ON DUPLICATE KEY UPDATE title=VALUES(title), type=VALUES(type), username=VALUES(username), deleted=0, updated_at=VALUES(updated_at)`;
    let count = 0;
    for (const it of items){
      const params = [deviceId, Number(it.id), String(it.title || 'Unknown'), it.type || null, it.username || null, now, now];
      await db.execute(sql, params);
      count++;
    }
    await db.execute(`INSERT INTO device_dialogs_sync (device_id, synced_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE synced_at=VALUES(synced_at)`, [deviceId, now]);
    return count;
  },

  markDeletedExcept: async (deviceId, keepPeerIds) => {
    const ids = (keepPeerIds || []).map(Number);
    if (!ids.length){
      await db.execute(`UPDATE device_dialogs SET deleted=1, updated_at=? WHERE device_id=?`, [new Date(), deviceId]);
      return;
    }
    const placeholders = ids.map(_=>'?').join(',');
    const params = [new Date(), deviceId, ...ids];
    await db.execute(`UPDATE device_dialogs SET deleted=1, updated_at=? WHERE device_id=? AND peer_id NOT IN (${placeholders})`, params);
  },

  listByDevice: async (deviceId, limit=50, offset=0) => {
    const [rows] = await db.execute(`SELECT peer_id AS id, title, type, username FROM device_dialogs WHERE device_id=? AND deleted=0 ORDER BY title ASC LIMIT ? OFFSET ?`, [deviceId, Number(limit), Number(offset)]);
    return rows || [];
  },

  countByDevice: async (deviceId) => {
    const [rows] = await db.execute(`SELECT COUNT(1) AS c FROM device_dialogs WHERE device_id=? AND deleted=0`, [deviceId]);
    return (rows && rows[0] && rows[0].c) ? Number(rows[0].c) : 0;
  },

  lastSyncedAt: async (deviceId) => {
    const [rows] = await db.execute(`SELECT synced_at FROM device_dialogs_sync WHERE device_id=?`, [deviceId]);
    return (rows && rows[0] && rows[0].synced_at) ? new Date(rows[0].synced_at) : null;
  }
};

module.exports = DeviceDialogs;
