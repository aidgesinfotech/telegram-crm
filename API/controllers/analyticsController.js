const db = require('../config/db');

exports.getBotSummary = async (req, res) => {
  try {
    const botId = Number(req.params.botId);
    const [[{ chat_count }]] = await db.query('SELECT COUNT(*) AS chat_count FROM chats WHERE bot_id = ?', [botId]);
    const [[{ member_count }]] = await db.query('SELECT COUNT(*) AS member_count FROM chat_members WHERE bot_id = ?', [botId]);
    const [[{ message_count }]] = await db.query('SELECT COUNT(*) AS message_count FROM messages WHERE bot_id = ?', [botId]);
    res.status(200).json({ status: 'success', data: { chat_count, member_count, message_count } });
  } catch (err) {
    console.error('Error getBotSummary:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getGlobalSummary = async (req, res) => {
  try {
    const [[{ bots }]] = await db.query('SELECT COUNT(*) AS bots FROM bots');
    const [[{ chats }]] = await db.query('SELECT COUNT(*) AS chats FROM chats');
    const [[{ members }]] = await db.query('SELECT COUNT(*) AS members FROM chat_members');
    const [[{ messages }]] = await db.query('SELECT COUNT(*) AS messages FROM messages');
    res.status(200).json({ status: 'success', data: { bots, chats, members, messages } });
  } catch (err) {
    console.error('Error getGlobalSummary:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
