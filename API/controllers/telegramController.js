const Bots = require('../models/botsModel');
const Chats = require('../models/chatsModel');
const ChatMembers = require('../models/chatMembersModel');
const Messages = require('../models/messagesModel');
const { emit, emitTo } = require('../config/socket');

function ok(res){ return res.status(200).json({ ok: true }); }

function unauthorized(res){ return res.status(401).json({ error: 'Unauthorized' }); }

module.exports.webhook = async (req, res) => {
  try {
    const secret = req.get('x-telegram-bot-api-secret-token') || req.get('X-Telegram-Bot-Api-Secret-Token');
    if (!secret || secret !== process.env.TG_SECRET) return unauthorized(res);

    const botId = Number(req.params.botId);
    if (!botId) return res.status(400).json({ error: 'Missing botId' });

    const update = req.body || {};

    // Immediately ack
    ok(res);

    // Process asynchronously (no await after response)
    setImmediate(async () => {
      try {
        // message in private/group/supergroup
        if (update.message) {
          const msg = update.message;
          try { await Chats.upsert(botId, msg.chat); } catch(e){}
          if (msg.from) {
            try { await ChatMembers.upsert(botId, msg.chat.id, msg.from, 'member'); } catch(e){}
          }
          try { await Messages.insertIfNotExists(botId, msg.chat.id, msg); } catch(e){}
          const payload = { bot_id: botId, chat_id: msg.chat.id, message: msg };
          emitTo(`chat:${botId}:${msg.chat.id}`, 'tg:message', payload);
          emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: msg.chat });
        }
        // channel posts
        if (update.channel_post) {
          const msg = update.channel_post;
          try { await Chats.upsert(botId, msg.chat); } catch(e){}
          try { await Messages.insertIfNotExists(botId, msg.chat.id, msg); } catch(e){}
          const payload = { bot_id: botId, chat_id: msg.chat.id, message: msg };
          emit('tg:message', payload);
          emitTo(`chat:${botId}:${msg.chat.id}`, 'tg:message', payload);
          emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: msg.chat });
        }
        // edited messages (optional basic handling)
        if (update.edited_message) {
          const msg = update.edited_message;
          const payload = { bot_id: botId, chat_id: msg.chat.id, message_id: msg.message_id, text: msg.text };
          emitTo(`chat:${botId}:${msg.chat.id}`, 'tg:message_edit', payload);
        }
        if (update.poll) {
          const p = update.poll;
          const payload = { poll: p };
          emit('tg:poll_update', payload);
        }
      } catch (e) {
        console.error('[telegram webhook] processing error:', e);
      }
    });
  } catch (e) {
    console.error('[telegram webhook] error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
};
