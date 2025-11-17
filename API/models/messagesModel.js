const db = require('../config/db');

const Messages = {
  insertIfNotExists: async (botId, chatId, msg) => {
    const raw = JSON.stringify(msg);
    const sql = `INSERT IGNORE INTO messages (bot_id, chat_id, message_id, from_user_id, text, raw, date, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;
    const params = [botId, chatId, msg.message_id, msg.from?.id || null, msg.text || null, raw, msg.date || null];
    const [results] = await db.execute(sql, params);
    return results;
  },
  insertOne: async (botId, chatId, messageId, fromUserId, text, raw, dateTs) => {
    const sql = `INSERT IGNORE INTO messages (bot_id, chat_id, message_id, from_user_id, text, raw, date, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;
    const params = [botId, chatId, messageId, fromUserId || null, text || null, raw ? JSON.stringify(raw) : null, dateTs || null];
    const [results] = await db.execute(sql, params);
    return results;
  },
  listByChat: async (botId, chatId, limit = 50, offset = 0) => {
    const [results] = await db.execute(
      `SELECT * FROM messages WHERE bot_id = ? AND chat_id = ? ORDER BY message_id DESC LIMIT ? OFFSET ?`,
      [botId, chatId, Number(limit), Number(offset)]
    );
    return { status: 'success', data: results };
  },
  deleteByChat: async (botId, chatId) => {
    const [results] = await db.execute(`DELETE FROM messages WHERE bot_id = ? AND chat_id = ?`, [botId, chatId]);
    return results;
  },
  deleteByIds: async (botId, chatId, ids = []) => {
    if (!ids || !ids.length) return { affectedRows: 0 };
    const placeholders = ids.map(() => '?').join(',');
    const params = [botId, chatId, ...ids];
    const [results] = await db.execute(`DELETE FROM messages WHERE bot_id = ? AND chat_id = ? AND message_id IN (${placeholders})`, params);
    return results;
  },
  getByIds: async (botId, chatId, ids = []) => {
    if (!ids || !ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const params = [botId, chatId, ...ids];
    const [results] = await db.execute(`SELECT * FROM messages WHERE bot_id = ? AND chat_id = ? AND message_id IN (${placeholders}) ORDER BY message_id ASC`, params);
    return results;
  }
};

module.exports = Messages;
