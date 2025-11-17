const Bots = require('../models/botsModel');
const Chats = require('../models/chatsModel');
const ChatMembers = require('../models/chatMembersModel');
const Messages = require('../models/messagesModel');
const { emit, emitTo } = require('../config/socket');
const axios = require('axios');

// Lazy require to avoid error if package not installed yet
let TelegramBot = null;
try { TelegramBot = require('node-telegram-bot-api'); } catch (e) { /* not installed yet */ }
// Map poll_id -> { botId, chatId, messageId }
const pollMessageMap = new Map();

// Send a checklist message with interactive toggles (works without Premium)
async function sendChecklist(botId, chatId, title = 'Checklist', items = []){
  let inst = instances.get(botId);
  if (!inst) inst = await ensureBot(botId);
  const bot = inst.bot;
  const lines = Array.isArray(items) ? items.map(s => String(s || '').trim()).filter(Boolean) : [];
  if (!lines.length) throw new Error('No checklist items');
  const text = [String(title || 'Checklist'), ...lines.map(x => `[ ] ${x}`)].join('\n');
  const sent = await bot.sendMessage(chatId, text, { disable_web_page_preview: true });
  // Build keyboard now that we have message_id
  const keyboard = {
    inline_keyboard: lines.map((_x, i) => [
      { text: `Toggle ${i+1}`, callback_data: `cl:${chatId}:${sent.message_id}:${i}` }
    ])
  };
  await bot.editMessageReplyMarkup(keyboard, { chat_id: chatId, message_id: sent.message_id });
  try{ await Messages.insertOne(botId, chatId, sent.message_id, null, text, sent, sent.date || Math.floor(Date.now()/1000)); }catch(e){}
  const payload = { bot_id: botId, chat_id: chatId, message: sent };
  emitTo(`chat:${botId}:${chatId}`, 'tg:message', payload);
  emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: chatId } });
  return sent;
}

// Send media (photo | video | document) with optional caption and reply
// media can be URL, file_id, Buffer, or Stream. fileOptions supports { filename, contentType }
async function sendMedia(botId, chatId, type, media, options = {}, fileOptions){
  let inst = instances.get(botId);
  if (!inst) inst = await ensureBot(botId);
  const bot = inst.bot;
  let r;
  const opts = { ...options };
  if (type === 'photo') {
    r = await bot.sendPhoto(chatId, media, opts, fileOptions);
  } else if (type === 'video') {
    r = await bot.sendVideo(chatId, media, opts, fileOptions);
  } else if (type === 'document') {
    r = await bot.sendDocument(chatId, media, opts, fileOptions);
  } else {
    throw new Error('Unsupported media type');
  }
  try {
    const storedText = r.caption || null;
    await Messages.insertOne(botId, chatId, r.message_id, null, storedText, r, r.date || Math.floor(Date.now()/1000));
  } catch(e) { /* ignore db error */ }
  const payload = { bot_id: botId, chat_id: chatId, message: r };
  emitTo(`chat:${botId}:${chatId}`, 'tg:message', payload);
  emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: chatId } });
  return r;
}

async function sendMessageOne(botId, chatId, text, options = {}){
  let inst = instances.get(botId);
  if (!inst) inst = await ensureBot(botId);
  const bot = inst.bot;
  const r = await bot.sendMessage(chatId, text, options);
  try{ await Messages.insertOne(botId, chatId, r.message_id, null, text, r, r.date || Math.floor(Date.now()/1000)); }catch(e){}
  const payload = { bot_id: botId, chat_id: chatId, message: r };
  emitTo(`chat:${botId}:${chatId}`, 'tg:message', payload);
  emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: chatId } });
  return r;
}

// Send a poll (regular or quiz)
async function sendPoll(botId, chatId, question, options = [], settings = {}){
  let inst = instances.get(botId);
  if (!inst) inst = await ensureBot(botId);
  const bot = inst.bot;
  const opts = (options || []).map(o => String(o));
  const payload = { ...settings };
  const r = await bot.sendPoll(chatId, String(question || ''), opts, payload);
  // store mapping poll_id -> message ids for live updates
  try { if (r && r.poll && r.poll.id) { pollMessageMap.set(String(r.poll.id), { botId, chatId, messageId: r.message_id }); } } catch(e){}
  try{ await Messages.insertOne(botId, chatId, r.message_id, null, null, r, r.date || Math.floor(Date.now()/1000)); }catch(e){}
  const pl = { bot_id: botId, chat_id: chatId, message: r };
  emitTo(`chat:${botId}:${chatId}`, 'tg:message', pl);
  emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: chatId } });
  return r;
}

const instances = new Map(); // botId -> { bot, token, name }

async function init() {
  if (!TelegramBot) {
    console.warn('[TelegramService] node-telegram-bot-api not installed. Bots will not start. Run: npm install node-telegram-bot-api');
    return; // dependency missing; init will be no-op
  }
  const base = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const secret = process.env.TG_SECRET;
  if (!base || !/^https:\/\//i.test(base)) {
    console.warn('[TelegramService] PUBLIC_URL missing or not https. Webhook registration skipped.');
  }
  if (!secret) {
    console.warn('[TelegramService] TG_SECRET missing. Webhook secret validation will fail.');
  }
  const active = await Bots.getActiveBots();
  for (const b of active) {
    await startBot(b.id, b.token, b.name);
    // Register webhook per bot
    if (base) {
      try {
        const url = `${base}/api/telegram/webhook/${b.id}`;
        // delete old webhook then set new
        await axios.post(`https://api.telegram.org/bot${b.token}/deleteWebhook`);
        await axios.post(`https://api.telegram.org/bot${b.token}/setWebhook`, {
          url,
          secret_token: secret
        });
        console.log(`[TelegramService] Webhook set for bot #${b.id} -> ${url}`);
      } catch (e) {
        console.error(`[TelegramService] Failed to set webhook for bot #${b.id}:`, e.message || e);
      }
    }
  }
}

async function startBot(botId, token, name) {
  if (!TelegramBot) {
    console.warn('[TelegramService] Cannot start bot without node-telegram-bot-api');
    return; // dependency missing
  }
  if (instances.has(botId)) return instances.get(botId);
  console.log(`[TelegramService] Starting bot ${name || ''} (#${botId})`);
  // Disable polling; use webhook for ingestion, but keep client for send APIs
  const bot = new TelegramBot(token, { polling: false });
  instances.set(botId, { bot, token, name });
  return instances.get(botId);
}

async function stopBot(botId) {
  const inst = instances.get(botId);
  if (inst) {
    console.log(`[TelegramService] Stopping bot #${botId}`);
    try { await inst.bot.stopPolling(); } catch (e) {}
    instances.delete(botId);
  }
}

async function restartBot(botId, token, name) {
  await stopBot(botId);
  return startBot(botId, token, name);
}

// Register Telegram webhook for a specific botId using env PUBLIC_URL and TG_SECRET
async function registerWebhook(botId){
  const base = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const secret = process.env.TG_SECRET;
  if (!base || !/^https:\/\//i.test(base)) throw new Error('PUBLIC_URL missing or not https');
  if (!secret) throw new Error('TG_SECRET missing');
  const b = await Bots.getById(botId);
  if (!b || !b.token) throw new Error('Bot not found or token missing');
  const url = `${base}/api/telegram/webhook/${botId}`;
  await axios.post(`https://api.telegram.org/bot${b.token}/deleteWebhook`);
  await axios.post(`https://api.telegram.org/bot${b.token}/setWebhook`, { url, secret_token: secret });
  return { status: 'ok', url };
}

// Get webhook info from Telegram
async function getWebhookInfo(botId){
  const b = await Bots.getById(botId);
  if (!b || !b.token) throw new Error('Bot not found or token missing');
  const r = await axios.get(`https://api.telegram.org/bot${b.token}/getWebhookInfo`);
  return r.data;
}

// Restart bot instance and re-register webhook
async function restartAndRegister(botId){
  const b = await Bots.getById(botId);
  if (!b || !b.token) throw new Error('Bot not found or token missing');
  await restartBot(botId, b.token, b.name);
  await registerWebhook(botId);
  return { status: 'ok' };
}

async function sendBulkMessages(botId, targets, text) {
  const inst = instances.get(botId);
  if (!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const results = [];
  for (const chatId of targets) {
    try {
      const r = await bot.sendMessage(chatId, text);
      results.push({ chatId, status: 'sent', message_id: r.message_id });
      // persist outgoing and emit
      try {
        await Messages.insertOne(botId, chatId, r.message_id, null, text, r, r.date || Math.floor(Date.now()/1000));
      } catch (e) { /* ignore */ }
      const payload = { bot_id: botId, chat_id: chatId, message: r };
      emitTo(`chat:${botId}:${chatId}`, 'tg:message', payload);
      emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: chatId } });
    } catch (e) {
      results.push({ chatId, status: 'failed', error: e.message });
    }
    await new Promise(r => setTimeout(r, 50)); // basic rate limit spacing
  }
  return results;
}

async function deleteMessages(botId, chatId, messageIds = []){
  const inst = instances.get(botId);
  if (!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const results = [];
  for(const mid of messageIds){
    try{ await bot.deleteMessage(chatId, mid); results.push({ message_id: mid, status: 'deleted' }); }
    catch(e){ results.push({ message_id: mid, status: 'failed', error: e.message }); }
    await new Promise(r => setTimeout(r, 30));
  }
  return results;
}

async function forwardText(botId, targetChatId, texts = []){
  // forwards as new messages with same text
  for(const t of texts){
    try{ await sendBulkMessages(botId, [targetChatId], String(t || '')); } catch(e){}
    await new Promise(r => setTimeout(r, 50));
  }
  return { status: 'ok' };
}

// Forward arbitrary messages by id (supports media) using forwardMessage (returns full Message)
async function forwardMessages(botId, fromChatId, messageIds = [], targetChatId){
  const inst = instances.get(botId);
  if (!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const results = [];
  for(const mid of (messageIds || [])){
    try{
      const r = await bot.forwardMessage(targetChatId, fromChatId, mid);
      results.push({ message_id: mid, status: 'forwarded', new_message_id: r.message_id });
      try{
        const storedText = r.text || r.caption || null;
        await Messages.insertOne(botId, targetChatId, r.message_id, null, storedText, r, r.date || Math.floor(Date.now()/1000));
      }catch(e){ /* ignore db error */ }
      const payload = { bot_id: botId, chat_id: targetChatId, message: r };
      emitTo(`chat:${botId}:${targetChatId}`, 'tg:message', payload);
      emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: targetChatId } });
    }catch(e){
      results.push({ message_id: mid, status: 'failed', error: e.message });
    }
    await new Promise(r => setTimeout(r, 50));
  }
  return results;
}

// Send message with inline or reply keyboard buttons
async function sendButtons(botId, chatId, text, replyMarkup = {}){
  let inst = instances.get(botId);
  if (!inst) inst = await ensureBot(botId);
  const bot = inst.bot;
  const opts = { reply_markup: replyMarkup };
  const r = await bot.sendMessage(chatId, String(text || ''), opts);
  try{ await Messages.insertOne(botId, chatId, r.message_id, null, String(text || ''), r, r.date || Math.floor(Date.now()/1000)); }catch(e){}
  const payload = { bot_id: botId, chat_id: chatId, message: r };
  emitTo(`chat:${botId}:${chatId}`, 'tg:message', payload);
  emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: chatId } });
  return r;
}

module.exports = { init, startBot, stopBot, restartBot, sendMessageOne, sendBulkMessages, deleteMessages, forwardText, forwardMessages, sendMedia, sendPoll, sendChecklist, sendButtons, registerWebhook, getWebhookInfo, restartAndRegister, ensureBot };
// expose instance map for internal controllers (read-only intent)
module.exports.__instances = instances;
module.exports.getInstances = () => instances;
// Set reaction on a message (Bot API 7.x)
async function setMessageReaction(botId, chatId, messageId, emoji){
  const inst = instances.get(botId);
  if (!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    reaction: [{ type: 'emoji', emoji: String(emoji || '❤') }],
    is_big: false
  };
  // node-telegram-bot-api internal request call: pass payload in 'form'
  if (typeof bot._request === 'function'){
    return bot._request('setMessageReaction', { form: payload });
  }
  throw new Error('setMessageReaction not supported by this bot instance');
}

module.exports.setMessageReaction = setMessageReaction;

async function editMessageText(botId, chatId, messageId, newText){
  const inst = instances.get(botId); if(!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const r = await bot.editMessageText(newText, { chat_id: chatId, message_id: messageId });
  // Update DB best-effort
  try{ await Messages.insertOne(botId, chatId, messageId, null, newText, r, r.date || Math.floor(Date.now()/1000)); }catch(e){}
  emitTo(`chat:${botId}:${chatId}`, 'tg:message_edit', { bot_id: botId, chat_id: chatId, message_id: messageId, text: newText });
  return r;
}
module.exports.editMessageText = editMessageText;

async function pinChatMessage(botId, chatId, messageId){
  const inst = instances.get(botId); if(!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const r = await bot.pinChatMessage(chatId, messageId);
  emitTo(`chat:${botId}:${chatId}`, 'tg:pin', { bot_id: botId, chat_id: chatId, message_id: messageId, pinned: true });
  return r;
}
async function unpinChatMessage(botId, chatId, messageId){
  const inst = instances.get(botId); if(!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const r = await bot.unpinChatMessage(chatId, { message_id: messageId });
  emitTo(`chat:${botId}:${chatId}`, 'tg:pin', { bot_id: botId, chat_id: chatId, message_id: messageId, pinned: false });
  return r;
}
module.exports.pinChatMessage = pinChatMessage;
module.exports.unpinChatMessage = unpinChatMessage;

// Set chat/channel title
async function setChatTitle(botId, chatId, newTitle){
  const inst = instances.get(botId); if(!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const r = await bot.setChatTitle(chatId, String(newTitle || ''));
  // notify clients about chat update
  emitTo(`bot:${botId}`, 'tg:chat_update', { bot_id: botId, chat: { id: chatId, title: newTitle } });
  return r;
}
module.exports.setChatTitle = setChatTitle;

// Total members/subscribers count
async function getChatMemberCount(botId, chatId){
  const inst = instances.get(botId); if(!inst) throw new Error('Bot not running');
  const bot = inst.bot;
  const n = await bot.getChatMemberCount(chatId);
  return typeof n === 'number' ? n : null;
}
module.exports.getChatMemberCount = getChatMemberCount;
