const Chats = require('../models/chatsModel');
const ChatMembers = require('../models/chatMembersModel');
const Messages = require('../models/messagesModel');
const TelegramService = require('../services/telegramService');
const { emitTo } = require('../config/socket');

exports.getChats = async (req, res) => {
  try {
    const botId = Number(req.params.botId);
    const type = req.query.type; // private | group | supergroup | channel
    const results = await Chats.listByBot(botId, type);
    res.status(200).json(results);
  } catch (err) {
    console.error('Error getChats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Return total members/subscribers count for a chat (groups/supergroups/channels)
exports.getCount = async (req, res) => {
  try {
    const botId = Number(req.params.botId);
    const chatId = Number(req.params.chatId);
    let count = null;
    try {
      count = await TelegramService.getChatMemberCount(botId, chatId);
    } catch (e) {
      // fallback to DB members table when available
      try {
        const results = await ChatMembers.listByChat(botId, chatId);
        const arr = results?.data || results || [];
        count = Array.isArray(arr) ? arr.length : null;
      } catch(_) {}
    }
    if (count == null) return res.status(404).json({ error: 'Count unavailable' });
    res.status(200).json({ status: 'success', count });
  } catch (err) {
    console.error('Error getCount:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Set chat/channel title via Telegram Bot API and update DB
exports.setChatTitle = async (req, res) => {
  try {
    const { bot_id, chat_id, title } = req.body || {};
    const botId = Number(bot_id);
    const chatId = Number(chat_id);
    const newTitle = String(title || '').trim();
    if (!botId || !chatId || !newTitle) return res.status(400).json({ error: 'bot_id, chat_id, title required' });
    const r = await TelegramService.setChatTitle(botId, chatId, newTitle);
    // best-effort: update DB cached chat title
    try { await Chats.upsert(botId, { id: chatId, type: null, title: newTitle }); } catch(_e) {}
    // notify clients
    emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: chatId, title: newTitle } });
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error setChatTitle:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Unified composite sender: optional media (file or url) + text + reply_markup + checklist
exports.sendComposite = async (req, res) => {
  try {
    const body = req.body || {};
    const botId = Number(body.bot_id ?? body.botId);
    const chatId = Number(body.chat_id ?? body.chatId);
    const text = body.text != null ? String(body.text) : '';
    const entities = Array.isArray(body.entities) ? body.entities : undefined;
    // optional checklist to merge into text
    const clTitle = body.checklist_title ? String(body.checklist_title) : '';
    const clItems = Array.isArray(body.checklist_items) ? body.checklist_items.map(String) : [];

    // reply markup (inline/reply keyboard)
    let reply_markup;
    if (body && body.reply_markup) {
      try { reply_markup = typeof body.reply_markup === 'string' ? JSON.parse(body.reply_markup) : body.reply_markup; } catch (_) {}
    }

    // sanitize inline keyboard URLs: only http/https and not localhost/private ranges
    const isHttpUrl = (u) => {
      try {
        const x = new URL(String(u));
        return (x.protocol === 'http:' || x.protocol === 'https:');
      } catch { return false; }
    };
    const isPrivateHost = (u) => {
      try {
        const h = new URL(String(u)).hostname.toLowerCase();
        if (h === 'localhost' || h === '::1') return true;
        if (/^127\./.test(h)) return true;
        if (/^10\./.test(h)) return true;
        if (/^192\.168\./.test(h)) return true;
        const m = h.match(/^172\.(\d+)\./);
        if (m) { const n = Number(m[1]); if (n >= 16 && n <= 31) return true; }
        return false;
      } catch { return true; }
    };
    const sanitizeReplyMarkup = (rm) => {
      if (!rm || typeof rm !== 'object') return rm;
      if (Array.isArray(rm.inline_keyboard)) {
        rm.inline_keyboard = rm.inline_keyboard.map(r => (Array.isArray(r) ? r : []).map((btn, idx) => {
          const b = { text: String(btn?.text || '') };
          const rawUrl = btn?.url ? String(btn.url).trim() : '';
          const data = btn?.callback_data ? String(btn.callback_data).trim() : '';
          if (rawUrl && isHttpUrl(rawUrl) && !isPrivateHost(rawUrl)) {
            b.url = rawUrl;
          } else if (data) {
            b.callback_data = data;
          } else {
            b.callback_data = 'cb:' + Date.now() + ':' + String(idx);
          }
          return b;
        }));
      }
      return rm;
    };
    if (reply_markup) reply_markup = sanitizeReplyMarkup(reply_markup);

    // compose final text with checklist if provided
    let finalText = text;
    if (clItems.length) {
      const header = clTitle || 'Checklist';
      const lines = clItems.filter(s => (s||'').trim()).map(s => `• ${s.trim()}`);
      if (lines.length) {
        finalText = [header, ...lines].join('\n') + (finalText ? ('\n\n' + finalText) : '');
      }
    }

    // detect media
    let media = body.media ?? body.mediaUrl ?? body.url;
    let mediaType = (body.type ?? body.mediaType ?? '').toString().toLowerCase();
    if (mediaType === 'file') mediaType = 'document';
    let fileOptions;
    if (req.file && req.file.buffer) {
      media = req.file.buffer;
      fileOptions = { filename: req.file.originalname, contentType: req.file.mimetype };
      // Auto-handle Telegram media size limits by switching to document
      const size = Number(req.file.size || req.file.buffer?.length || 0);
      const PHOTO_MAX = 10 * 1024 * 1024; // 10MB
      const VIDEO_MAX = 50 * 1024 * 1024; // ~50MB typical Bot API limit
      if (mediaType === 'photo' && size > PHOTO_MAX) {
        mediaType = 'document';
      }
      if (mediaType === 'video' && size > VIDEO_MAX) {
        mediaType = 'document';
      }
    }

    if (!botId || !chatId) return res.status(400).json({ error: 'bot_id and chat_id are required' });

    if (media) {
      const opts = {};
      if (finalText) opts.caption = finalText;
      if (reply_markup) opts.reply_markup = reply_markup;
      const r = await TelegramService.sendMedia(botId, chatId, mediaType || 'photo', media, opts, fileOptions);
      return res.status(200).json({ status: 'success', data: r });
    }

    const options = {};
    if (entities && entities.length) options.entities = entities;
    if (reply_markup) options.reply_markup = reply_markup;
    const r = await TelegramService.sendMessageOne(botId, chatId, String(finalText || ''), options);
    return res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error sendComposite:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Send message with buttons (inline_keyboard or reply keyboard)
exports.sendButtons = async (req, res) => {
  try {
    const body = req.body || {};
    const botId = Number(body.bot_id ?? body.botId);
    const chatId = Number(body.chat_id ?? body.chatId);
    const text = String(body.text || '');
    const keyboardType = String(body.keyboard_type || 'inline');
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!botId || !chatId || !text) {
      return res.status(400).json({ error: 'bot_id, chat_id and text are required' });
    }
    let replyMarkup = {};
    if (keyboardType === 'reply') {
      const keyboard = rows.map(r => (Array.isArray(r) ? r : []).map(btn => String(btn?.text || '')));
      replyMarkup = {
        keyboard,
        resize_keyboard: Boolean(body.resize_keyboard ?? true),
        one_time_keyboard: Boolean(body.one_time_keyboard ?? false)
      };
    } else {
      // inline keyboard
      const isHttpUrl = (u) => /^https?:\/\//i.test(String(u || ''));
      const inline_keyboard = rows.map(r => (Array.isArray(r) ? r : []).map((btn, idx) => {
        const b = { text: String(btn?.text || '') };
        const rawUrl = btn?.url ? String(btn.url).trim() : '';
        const data = btn?.callback_data ? String(btn.callback_data).trim() : '';
        if (rawUrl && isHttpUrl(rawUrl)) {
          (b).url = rawUrl;
        } else if (data) {
          (b).callback_data = data;
        } else {
          // ensure callback_data present to avoid invalid URL error
          (b).callback_data = 'cb:' + Date.now() + ':' + String(idx);
        }
        return b;
      }));
      replyMarkup = { inline_keyboard };
    }
    const r = await TelegramService.sendButtons(botId, chatId, text, replyMarkup);
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error sendButtons:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create and send a checklist (interactive via inline keyboard)
exports.sendChecklist = async (req, res) => {
  try {
    const body = req.body || {};
    const botId = Number(body.bot_id ?? body.botId);
    const chatId = Number(body.chat_id ?? body.chatId);
    const title = String(body.title || 'Checklist');
    const items = Array.isArray(body.items) ? body.items.map(String) : [];
    if (!botId || !chatId || !items.length) {
      return res.status(400).json({ error: 'bot_id, chat_id, and at least 1 item required' });
    }
    const r = await TelegramService.sendChecklist(botId, chatId, title, items);
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error sendChecklist:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create and send a poll
exports.sendPoll = async (req, res) => {
  try {
    const body = req.body || {};
    const botId = Number(body.bot_id ?? body.botId);
    const chatId = Number(body.chat_id ?? body.chatId);
    const question = String(body.question || '');
    const options = Array.isArray(body.options) ? body.options.map(String) : [];
    const settings = {
      is_anonymous: Boolean(body.is_anonymous ?? true),
      allows_multiple_answers: Boolean(body.allows_multiple_answers ?? false),
    };
    if (body.is_quiz) {
      settings.type = 'quiz';
      if (body.correct_option_id != null) settings.correct_option_id = Number(body.correct_option_id);
    }
    if (!botId || !chatId || !question || options.length < 2) {
      return res.status(400).json({ error: 'bot_id, chat_id, question, at least 2 options required' });
    }
    const r = await TelegramService.sendPoll(botId, chatId, question, options, settings);
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error sendPoll:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// React to a message with an emoji
exports.reactMessage = async (req, res) => {
  try {
    const { bot_id, chat_id, message_id, emoji } = req.body;
    const result = await TelegramService.setMessageReaction(bot_id, Number(chat_id), Number(message_id), String(emoji || '❤'));
    // notify clients
    emitTo(`chat:${bot_id}:${chat_id}`, 'tg:reaction', { bot_id, chat_id, message_id, emoji });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    console.error('Error reactMessage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const botId = Number(req.params.botId);
    const chatId = Number(req.params.chatId);
    const results = await ChatMembers.listByChat(botId, chatId);
    res.status(200).json(results);
  } catch (err) {
    console.error('Error getMembers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const botId = Number(req.params.botId);
    const chatId = Number(req.params.chatId);
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);
    const results = await Messages.listByChat(botId, chatId, limit, offset);
    const baseUrl = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
    const data = (results.data || []).map(row => {
      let raw;
      try { raw = row.raw ? JSON.parse(row.raw) : null; } catch(e) { raw = null; }
      const baseRow = { ...row };
      if (!raw) return baseRow;

      // Detect media types and build preview similar to Telegram
      if (raw.photo && Array.isArray(raw.photo)) {
        const sizes = raw.photo;
        const largest = sizes[sizes.length - 1];
        const smallest = sizes[0];
        baseRow.media = {
          kind: 'photo',
          caption: raw.caption || null,
          width: largest?.width,
          height: largest?.height,
          thumb_url: smallest?.file_id ? `${baseUrl}/api/chats/file/${botId}/${smallest.file_id}` : null,
          file_url: largest?.file_id ? `${baseUrl}/api/chats/file/${botId}/${largest.file_id}` : null,
          file_id: largest?.file_id
        };
      } else if (raw.video) {
        baseRow.media = {
          kind: 'video',
          caption: raw.caption || null,
          width: raw.video.width,
          height: raw.video.height,
          duration: raw.video.duration,
          thumb_url: raw.video.thumbnail?.file_id ? `${baseUrl}/api/chats/file/${botId}/${raw.video.thumbnail.file_id}` : null,
          file_url: raw.video.file_id ? `${baseUrl}/api/chats/file/${botId}/${raw.video.file_id}` : null,
          file_id: raw.video.file_id,
          mime_type: raw.video.mime_type
        };
      } else if (raw.document) {
        baseRow.media = {
          kind: 'document',
          caption: raw.caption || null,
          file_name: raw.document.file_name,
          mime_type: raw.document.mime_type,
          size: raw.document.file_size,
          thumb_url: raw.document.thumbnail?.file_id ? `${baseUrl}/api/chats/file/${botId}/${raw.document.thumbnail.file_id}` : null,
          file_url: raw.document.file_id ? `${baseUrl}/api/chats/file/${botId}/${raw.document.file_id}` : null,
          file_id: raw.document.file_id
        };
      } else if (raw.poll) {
        const p = raw.poll;
        baseRow.media = {
          kind: 'poll',
          question: p.question,
          is_anonymous: p.is_anonymous,
          type: p.type,
          allows_multiple_answers: p.allows_multiple_answers,
          is_closed: p.is_closed,
          options: (p.options || []).map(o => ({ text: o.text, voter_count: o.voter_count }))
        };
      }
      // attach reply_markup for inline/reply keyboards (if present on message)
      try {
        if (raw.reply_markup && typeof raw.reply_markup === 'object') {
          baseRow.reply_markup = raw.reply_markup;
        }
      } catch(_){ }

      // Service events: title change, pins, joins, leaves etc. (we implement title change now)
      try {
        if (raw.new_chat_title) {
          baseRow.type = 'service';
          const t = String(raw.new_chat_title);
          baseRow.text = `Channel name was changed to «${t}»`;
        }
      } catch(_){ }
      return baseRow;
    });
    res.status(200).json({ status: 'success', data });
  } catch (err) {
    console.error('Error getMessages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Stream a Telegram file by file_id through the bot (proxy to avoid exposing token)
exports.streamFile = async (req, res) => {
  try {
    const botId = Number(req.params.botId);
    const fileId = String(req.params.fileId);
    const inst = require('../services/telegramService');
    const map = inst && inst.__instances ? inst.__instances : null;
    const bot = map ? map.get(botId)?.bot : null;
    if (!bot) return res.status(404).json({ error: 'Bot not running' });
    const file = await bot.getFile(fileId);
    const path = file?.file_path;
    if (!path) return res.status(404).json({ error: 'File not found' });
    const token = bot.token;
    const url = `https://api.telegram.org/file/bot${token}/${path}`;
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'stream' });
    // Forward upstream headers when possible
    const uct = response.headers && (response.headers['content-type'] || response.headers['Content-Type']);
    const ucl = response.headers && (response.headers['content-length'] || response.headers['Content-Length']);
    if (ucl) res.setHeader('Content-Length', String(ucl));
    else if (file.file_size) res.setHeader('Content-Length', String(file.file_size));
    if (uct) res.setHeader('Content-Type', uct);
    else {
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
      else if (path.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
      else if (path.endsWith('.mp4')) res.setHeader('Content-Type', 'video/mp4');
      else res.setHeader('Content-Type', 'application/octet-stream');
    }
    // Optional filename for downloads
    const filename = (req.query && req.query.filename) ? String(req.query.filename) : '';
    if (filename) {
      const encoded = encodeURIComponent(filename).replace(/\*/g, '%2A');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    }
    response.data.pipe(res);
  } catch (err) {
    console.error('Error streamFile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { bot_id, chat_id, text, entities } = req.body;
    const options = {};
    if (Array.isArray(entities) && entities.length) options.entities = entities;
    // optional reply markup (inline/reply keyboard)
    if (req.body && req.body.reply_markup) {
      try {
        const rm = typeof req.body.reply_markup === 'string' ? JSON.parse(req.body.reply_markup) : req.body.reply_markup;
        if (rm && typeof rm === 'object') options.reply_markup = rm;
      } catch (_) {}
    }
    const r = await TelegramService.sendMessageOne(bot_id, Number(chat_id), String(text || ''), options);
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error sendMessage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Send media (photo | video | document)
exports.sendMedia = async (req, res) => {
  try {
    const body = req.body || {};
    const botId = Number(body.bot_id ?? body.botId);
    const chatId = Number(body.chat_id ?? body.chatId);
    const type = String((body.type ?? body.mediaType ?? '')).toLowerCase();
    const caption = body.caption;
    const replyTo = body.reply_to_message_id ?? body.replyToMessageId;

    const opts = {};
    if (caption != null) opts.caption = String(caption);
    if (replyTo) opts.reply_to_message_id = Number(replyTo);
    // optional reply markup from multipart or JSON body
    if (body && body.reply_markup) {
      try {
        const rm = typeof body.reply_markup === 'string' ? JSON.parse(body.reply_markup) : body.reply_markup;
        if (rm && typeof rm === 'object') opts.reply_markup = rm;
      } catch (_) {}
    }

    let media = body.media ?? body.mediaUrl ?? body.url;
    let fileOptions;
    if (req.file && req.file.buffer) {
      media = req.file.buffer;
      fileOptions = { filename: req.file.originalname, contentType: req.file.mimetype };
    }

    if (!botId || !chatId || !type || !media) {
      return res.status(400).json({ error: 'bot_id, chat_id, type, media are required' });
    }

    const r = await TelegramService.sendMedia(botId, chatId, type, media, opts, fileOptions);
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error sendMedia:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reply to a specific message
exports.replyMessage = async (req, res) => {
  try {
    const { bot_id, chat_id, reply_to_message_id, text } = req.body;
    const opt = { reply_to_message_id: Number(reply_to_message_id) };
    const r = await TelegramService.sendMessageOne(bot_id, Number(chat_id), String(text || ''), opt);
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error replyMessage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Edit an existing message text
exports.editMessage = async (req, res) => {
  try {
    const { bot_id, chat_id, message_id, text } = req.body;
    const r = await TelegramService.editMessageText(bot_id, Number(chat_id), Number(message_id), String(text || ''));
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error editMessage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Pin/unpin
exports.pinMessage = async (req, res) => {
  try {
    const { bot_id, chat_id, message_id } = req.body;
    const r = await TelegramService.pinChatMessage(bot_id, Number(chat_id), Number(message_id));
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error pinMessage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.unpinMessage = async (req, res) => {
  try {
    const { bot_id, chat_id, message_id } = req.body;
    const r = await TelegramService.unpinChatMessage(bot_id, Number(chat_id), Number(message_id));
    res.status(200).json({ status: 'success', data: r });
  } catch (err) {
    console.error('Error unpinMessage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete all messages from a chat (DB + Telegram)
exports.clearChat = async (req, res) => {
  try {
    const { bot_id, chat_id } = req.body;
    // Fetch ids to delete from DB first
    const list = await Messages.listByChat(bot_id, chat_id, 5000);
    const ids = (list?.data || []).map(r => Number(r.message_id)).filter(Boolean);
    // Telegram delete (best-effort)
    try { await TelegramService.deleteMessages(bot_id, chat_id, ids); } catch (e) { console.warn('tg delete err', e?.message); }
    // DB delete
    await Messages.deleteByChat(bot_id, chat_id);
    res.status(200).json({ status: 'success', deleted: ids.length });
  } catch (err) {
    console.error('Error clearChat:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete selected message ids
exports.deleteMessages = async (req, res) => {
  try {
    const { bot_id, chat_id, message_ids } = req.body;
    const ids = (message_ids || []).map(Number).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'No message ids' });
    try { await TelegramService.deleteMessages(bot_id, chat_id, ids); } catch (e) { console.warn('tg delete err', e?.message); }
    await Messages.deleteByIds(bot_id, chat_id, ids);
    res.status(200).json({ status: 'success', deleted: ids.length });
  } catch (err) {
    console.error('Error deleteMessages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Forward selected messages. If ids present, copy messages (supports media); else fallback to text list
exports.forwardMessages = async (req, res) => {
  try {
    const { bot_id, from_chat_id, message_ids, target_chat_id } = req.body;
    const ids = (message_ids || []).map(Number).filter(Boolean);
    if (ids.length) {
      const result = await TelegramService.forwardMessages(bot_id, from_chat_id, ids, target_chat_id);
      return res.status(200).json({ status: 'success', data: result, forwarded: result.length });
    }
    // fallback to text-only if no ids
    const rows = await Messages.getByIds(bot_id, from_chat_id, []);
    const texts = rows.map(r => r.text).filter(t => t != null);
    const result = await TelegramService.forwardText(bot_id, target_chat_id, texts);
    res.status(200).json({ status: 'success', data: result, forwarded: texts.length });
  } catch (err) {
    console.error('Error forwardMessages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
