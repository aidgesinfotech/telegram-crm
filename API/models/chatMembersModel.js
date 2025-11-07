const db = require('../config/db');

const ChatMembers = {
  upsert: async (botId, chatId, user, status) => {
    const sql = `INSERT INTO chat_members (bot_id, chat_id, user_id, username, first_name, last_name, is_bot, status, joined_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE username = VALUES(username), first_name = VALUES(first_name), last_name = VALUES(last_name), is_bot = VALUES(is_bot), status = VALUES(status), updated_at = NOW()`;
    const params = [botId, chatId, user.id, user.username || null, user.first_name || null, user.last_name || null, user.is_bot ? 1 : 0, status || null];
    const [results] = await db.execute(sql, params);
    return results;
  },
  listByChat: async (botId, chatId) => {
    const [results] = await db.execute(`SELECT * FROM chat_members WHERE bot_id = ? AND chat_id = ? ORDER BY updated_at DESC`, [botId, chatId]);
    return { status: 'success', data: results };
  }
};

module.exports = ChatMembers;
