const RouteRules = require('../models/routeRulesModel');
const TelegramService = require('./telegramService');
const mt = require('./mtprotoService');
const Devices = require('../models/devicesModel');
const Messages = require('../models/messagesModel');
const Chats = require('../models/chatsModel');

// naive in-memory dedupe (deviceId:chatId:msgId:ruleId)
const seen = new Map();
const TTL_MS = 5 * 60 * 1000;
function markSeen(key){ seen.set(key, Date.now() + TTL_MS); }
function isSeen(key){ const t = seen.get(key); if (!t) return false; if (Date.now() > t){ seen.delete(key); return false; } return true; }
setInterval(()=>{ const now = Date.now(); for(const [k, t] of seen.entries()){ if (now > t) seen.delete(k); } }, 60 * 1000).unref?.();

async function init(){
  // Attach update handlers for all devices that have sessions
  try{
    const devices = await Devices.list();
    for(const d of devices){
      try{ await mt.ensureUpdateHandler(d.id); }catch(e){ /* skip */ }
    }
  }catch(e){ /* ignore */ }

  // Subscribe to MTProto updates
  mt.updates.on('message', async (evt) => {
    try{
      const { deviceId, chatId, messageId, text, media } = evt;
      // fetch rules for this (device, source)
      const rules = await RouteRules.listActiveForSource(deviceId, chatId);
      if (!rules || !rules.length) return;

      for(const r of rules){
        const key = `${deviceId}:${chatId}:${messageId}:${r.id}`;
        if (isSeen(key)) continue; markSeen(key);
        try{
          // If media is present, re-upload via Bot API; else send text.
          if (media && media.buffer){
            let type = 'document';
            if (media.type === 'photo') type = 'photo';
            else if (media.type === 'video') type = 'video';
            const fileOpts = {};
            if (media.filename) fileOpts.filename = media.filename;
            if (media.mime) fileOpts.contentType = media.mime;
            const options = {};
            if (text) options.caption = String(text);
            await TelegramService.sendMedia(Number(r.bot_id), Number(r.dest_chat_id), type, media.buffer, options, fileOpts);
          } else if (text && String(text).trim().length){
            await TelegramService.sendMessageOne(Number(r.bot_id), Number(r.dest_chat_id), String(text));
          }
        }catch(e){
          // On destination errors (chat deleted / not found / forbidden), cleanup and disable rules for this dest
          const msg = String(e && (e.message || e) || '').toLowerCase();
          if (msg.includes('chat not found') || msg.includes('forbidden') || msg.includes('not a member') || msg.includes('chat has been deleted') || msg.includes('bot was kicked')){
            try{
              await RouteRules.disableByDest(Number(r.bot_id), Number(r.dest_chat_id));
              try{ await Messages.deleteByChat(Number(r.bot_id), Number(r.dest_chat_id)); }catch(_m){}
              try{ await Chats.deleteByChat(Number(r.bot_id), Number(r.dest_chat_id)); }catch(_c){}
            }catch(_e){}
          }
        }
      }
    }catch(e){ /* ignore */ }
  });

  // Periodic audit: disable rules whose source chat no longer exists in device dialogs
  const AUDIT_MS = 10 * 60 * 1000;
  setInterval(async ()=>{
    try{
      const devices = await Devices.list();
      for (const d of (devices || [])){
        try{
          const dialogs = await mt.listDialogs(d.id);
          const existing = new Set((dialogs || []).map(x => Number(x.id)));
          const rules = await RouteRules.listByDevice(d.id);
          for (const r of (rules || [])){
            if (!existing.has(Number(r.source_chat_id)) && r.enabled){
              try{ await RouteRules.disableBySource(Number(r.device_id), Number(r.source_chat_id)); }catch(_e){}
            }
          }
        }catch(_e){}
      }
    }catch(_e){}
  }, AUDIT_MS).unref?.();
}

module.exports = { init };
