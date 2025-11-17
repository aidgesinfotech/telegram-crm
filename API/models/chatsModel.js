const db = require('../config/db');

const Chats = {
  upsert: async (botId, chat) => {
    const sql = `INSERT INTO chats (bot_id, chat_id, type, title, username, first_name, last_name, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE type = VALUES(type), title = VALUES(title), username = VALUES(username), first_name = VALUES(first_name), last_name = VALUES(last_name), updated_at = NOW()`;
    const params = [botId, chat.id, chat.type || null, chat.title || null, chat.username || null, chat.first_name || null, chat.last_name || null];
    const [results] = await db.execute(sql, params);
    return results;
  },
  listByBot: async (botId, filterType) => {
    let sql = `SELECT * FROM chats WHERE bot_id = ?`;
    const params = [botId];
    if (filterType) { sql += ` AND type = ?`; params.push(filterType); }
    sql += ` ORDER BY updated_at DESC`;
    const [results] = await db.execute(sql, params);
    return { status: 'success', data: results };
  },
  deleteByChat: async (botId, chatId) => {
    const [results] = await db.execute(`DELETE FROM chats WHERE bot_id = ? AND chat_id = ?`, [botId, chatId]);
    return results;
  }
};

module.exports = Chats;
