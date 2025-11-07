const Devices = require('../models/devicesModel');
const DeviceSessions = require('../models/deviceSessionsModel');
const { encrypt, decrypt } = require('./cryptoUtil');
const { EventEmitter } = require('events');

let TelegramClient, StringSession, Api, computeCheck;
try {
  ({ TelegramClient } = require('telegram'));
  ({ StringSession } = require('telegram/sessions'));
  ({ Api } = require('telegram'));
  ({ computeCheck } = require('telegram/Password'));
} catch (e) {
  // dependency missing; functions will throw when used
}

const state = new Map(); // deviceId -> { client, phone, phoneCodeHash, handlerAttached, creatingPromise }
const updates = new EventEmitter(); // emits { deviceId, chatId, messageId, text, raw }

function ensureDeps(){
  if (!TelegramClient || !StringSession || !Api) throw new Error('telegram (GramJS) not installed');
  if (!process.env.API_ID || !process.env.API_HASH) throw new Error('API_ID/API_HASH missing');
}

async function getClientForDevice(deviceId){
  ensureDeps();
  const st = state.get(deviceId) || {};
  if (st.client) return st.client;
  if (st.creatingPromise) return await st.creatingPromise;
  const creating = (async ()=>{
    const sessRow = await DeviceSessions.getPrimary(deviceId);
    const sessionStr = sessRow && sessRow.session_data ? (decrypt(sessRow.session_data).session || '') : '';
    const client = new TelegramClient(new StringSession(sessionStr), Number(process.env.API_ID), String(process.env.API_HASH), { connectionRetries: 3 });
    await client.connect();
    state.set(deviceId, { ...(state.get(deviceId) || {}), client, creatingPromise: null });
    return client;
  })();
  state.set(deviceId, { ...(state.get(deviceId) || {}), creatingPromise: creating });
  return await creating;
}

async function ensureUpdateHandler(deviceId){
  try{
    const st = state.get(deviceId) || {};
    if (st.handlerAttached) return;
    const client = await getClientForDevice(deviceId);
    let events;
    try { events = require('telegram/events'); } catch(e){ /* events not available until deps installed */ }
    if (events && client && typeof client.addEventHandler === 'function'){
      const handler = async (event) => {
        try{
          const msg = event.message || event;
          if (!msg) return;
          const chatId = (msg.chat && (msg.chat.id || msg.chat.peerId)) || msg.chatId || (msg.peerId && (msg.peerId.channelId || msg.peerId.userId || msg.peerId.chatId));
          const messageId = msg.id || msg.messageId;
          const text = msg.message || msg.text || (msg.caption || null);
          if (!chatId || !messageId) return;
          let media = null;
          try{
            const hasMedia = !!(msg.media || msg.photo || msg.document || msg.video || msg.sticker || msg.animation);
            if (hasMedia && typeof client.downloadMedia === 'function'){
              const buffer = await client.downloadMedia(msg, {});
              if (buffer){
                let mime = null, filename = null, kind = 'document';
                try{
                  const doc = msg.document || (msg.media && msg.media.document);
                  const photo = msg.photo || (msg.media && msg.media.photo);
                  if (photo){ kind = 'photo'; }
                  if (doc){
                    mime = doc.mimeType || null;
                    const attr = (doc.attributes || []).find(a=>a.fileName);
                    filename = (attr && attr.fileName) || null;
                    if (mime && /^video\//i.test(String(mime))) kind = 'video';
                    else if (mime && /^image\//i.test(String(mime))) kind = 'photo';
                  }
                }catch(_e){}
                media = { buffer, mime: mime || null, filename: filename || null, type: kind };
              }
            }
          }catch(_e){}
          updates.emit('message', { deviceId, chatId: Number(chatId), messageId: Number(messageId), text: text || null, media, raw: safeRaw(msg) });
        }catch(_e){ /* ignore single update errors */ }
      };
      try{
        client.addEventHandler(handler, new events.NewMessage({}));
      }catch(_e){
        // fallback: try without filter
        try{ client.addEventHandler(handler); }catch(__e){}
      }
      state.set(deviceId, { ...(state.get(deviceId) || {}), client, handlerAttached: true });
    }
  }catch(e){ /* ignore ensure error */ }
}

function safeRaw(msg){
  try{
    return {
      id: msg.id || null,
      chatId: msg.chatId || null,
      isChannel: !!msg.isChannel,
      message: msg.message || null,
      caption: msg.caption || null,
      date: msg.date || null
    };
  }catch(_e){ return null; }
}

async function startLogin(phone){
  ensureDeps();
  const { id } = await Devices.createPending(phone);
  const client = new TelegramClient(new StringSession(''), Number(process.env.API_ID), String(process.env.API_HASH), { connectionRetries: 3 });
  await client.connect();
  const res = await client.invoke(new Api.auth.SendCode({
    phoneNumber: phone,
    apiId: Number(process.env.API_ID),
    apiHash: String(process.env.API_HASH),
    settings: new Api.CodeSettings({})
  }));
  state.set(id, { client, phone, phoneCodeHash: res.phoneCodeHash });
  return { deviceId: id };
}

async function submitCode(deviceId, code){
  ensureDeps();
  const st = state.get(deviceId);
  if (!st) throw new Error('No pending login');
  const { client, phone, phoneCodeHash } = st;
  try{
    const r = await client.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: String(code) }));
    const me = await client.getMe();
    const session = client.session.save();
    const profile = { username: me?.username || null, display_name: [me?.firstName, me?.lastName].filter(Boolean).join(' ') || null };
    await Devices.markActive(deviceId, profile);
    const enc = encrypt({ session });
    await DeviceSessions.updatePrimary(deviceId, enc);
    state.delete(deviceId);
    return { status: 'ok', deviceId };
  }catch(e){
    // If 2FA needed, Telegram returns SESSION_PASSWORD_NEEDED
    if (String(e.message || '').toUpperCase().includes('SESSION_PASSWORD_NEEDED')){
      return { status: 'password_required', deviceId };
    }
    throw e;
  }
}

async function submitPassword(deviceId, password){
  ensureDeps();
  const st = state.get(deviceId);
  if (!st) throw new Error('No pending login');
  const { client } = st;
  const pwd = await client.invoke(new Api.account.GetPassword());
  const cp = await computeCheck(pwd, String(password));
  await client.invoke(new Api.auth.CheckPassword({ password: new Api.InputCheckPasswordSRP({ srpId: cp.srp_id, A: cp.A, M1: cp.M1 }) }));
  const me = await client.getMe();
  const session = client.session.save();
  const profile = { username: me?.username || null, display_name: [me?.firstName, me?.lastName].filter(Boolean).join(' ') || null };
  await Devices.markActive(deviceId, profile);
  const enc = encrypt({ session });
  await DeviceSessions.updatePrimary(deviceId, enc);
  state.delete(deviceId);
  return { status: 'ok', deviceId };
}

async function deactivate(deviceId){
  // soft deactivate: mark inactive; optionally log out client if in memory
  try{
    const st = state.get(deviceId);
    if (st && st.client){
      try{ await st.client.logOut(); }catch(_e){}
      try{ await st.client.disconnect(); }catch(_e){}
      state.delete(deviceId);
    }
  }catch(_e){}
  await Devices.markInactive(deviceId);
  return { status: 'ok' };
}

async function status(deviceId){
  const d = await Devices.getById(deviceId);
  return d ? { status: d.status, device: d } : { status: 'not_found' };
}

async function list(){
  const rows = await Devices.list();
  return rows;
}

async function listDialogs(deviceId){
  ensureDeps();
  let client = await getClientForDevice(deviceId);
  let dialogs = [];
  try{
    dialogs = await client.getDialogs({});
  }catch(e){
    const msg = String(e && (e.message || e) || '').toUpperCase();
    // Recover from AUTH_KEY_DUPLICATED by resetting client once
    if (msg.includes('AUTH_KEY_DUPLICATED')){
      try{ await client.disconnect?.(); }catch(_e){}
      state.set(deviceId, {});
      client = await getClientForDevice(deviceId);
      try{ dialogs = await client.getDialogs({}); }catch(_e2){ dialogs = []; }
    } else {
      dialogs = [];
    }
  }
  const items = [];
  try{
    for (const d of dialogs){
      try{
        const entity = d.entity || d.chat || d;
        const id = (entity && (entity.id || entity.chatId || entity.channelId)) || d.id;
        const title = entity && (entity.title || entity.firstName || entity.lastName) || d.name || 'Unknown';
        if (id) items.push({ id: Number(id), title: String(title) });
      }catch(_e){}
    }
  }catch(_e){}
  return items;
}

module.exports = { startLogin, submitCode, submitPassword, deactivate, status, list, listDialogs };
module.exports.updates = updates;
module.exports.ensureUpdateHandler = ensureUpdateHandler;
