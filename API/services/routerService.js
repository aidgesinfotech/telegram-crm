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

function parseTransformsJson(val){
  try{
    if (!val) return null;
    if (typeof val === 'string') return JSON.parse(val);
    if (typeof val === 'object') return val;
  }catch(_e){}
  return null;
}

function replaceLinks(text, replacement){
  if (!text || !replacement) return text;
  const urlRe = /(https?:\/\/\S+)/gi;
  return String(text).replace(urlRe, replacement);
}

function applyTransformsToText(text, transformsJson){
  const cfg = parseTransformsJson(transformsJson);
  if (!cfg) return text;
  let out = String(text || '');
  if (cfg.link_replace){
    out = replaceLinks(out, String(cfg.link_replace));
  }
  const repls = Array.isArray(cfg.text_replace) ? cfg.text_replace : [];
  for (const r of repls){
    try{
      const from = (r && r.from != null) ? String(r.from) : '';
      const to = (r && r.to != null) ? String(r.to) : '';
      if (!from) continue;
      // simple global, case-sensitive replace
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'g');
      out = out.replace(re, to);
    }catch(_e){}
  }
  return out;
}

// Stabilizers: require consecutive failures before disabling
const destFailMap = new Map(); // key `${botId}:${chatId}` -> { count, ts }
const sourceMissMap = new Map(); // key `${deviceId}:${sourceId}` -> { miss, ts }
const FAIL_THRESHOLD = 3; // disable after 3 consecutive failures
const MISS_THRESHOLD = 3; // disable after missing in 3 audits
function incDestFail(botId, chatId){
  const k = `${botId}:${chatId}`; const v = destFailMap.get(k) || { count:0, ts:0 }; v.count++; v.ts = Date.now(); destFailMap.set(k, v); return v.count;
}
function resetDestFail(botId, chatId){ destFailMap.delete(`${botId}:${chatId}`); }
function incSourceMiss(devId, srcId){ const k = `${devId}:${srcId}`; const v = sourceMissMap.get(k) || { miss:0, ts:0 }; v.miss++; v.ts = Date.now(); sourceMissMap.set(k, v); return v.miss; }
function resetSourceMiss(devId, srcId){ sourceMissMap.delete(`${devId}:${srcId}`); }

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
            if (text) {
              const t = applyTransformsToText(String(text), r.transforms_json);
              options.caption = t;
            }
            await TelegramService.sendMedia(Number(r.bot_id), Number(r.dest_chat_id), type, media.buffer, options, fileOpts);
          } else if (text && String(text).trim().length){
            const t = applyTransformsToText(String(text), r.transforms_json);
            await TelegramService.sendMessageOne(Number(r.bot_id), Number(r.dest_chat_id), t);
          }
          // success -> reset failure counter for this destination
          resetDestFail(Number(r.bot_id), Number(r.dest_chat_id));
        }catch(e){
          // On destination errors (chat deleted / not found / forbidden), cleanup and disable rules for this dest
          const msg = String(e && (e.message || e) || '').toLowerCase();
          const isPermanent = (msg.includes('chat not found') || msg.includes('bot was kicked') || msg.includes('chat has been deleted'));
          const isForbidden = (msg.includes('forbidden') || msg.includes('not a member'));
          if (isPermanent || isForbidden){
            const fails = incDestFail(Number(r.bot_id), Number(r.dest_chat_id));
            if (fails >= FAIL_THRESHOLD){
              try{
                await RouteRules.disableByDest(Number(r.bot_id), Number(r.dest_chat_id));
                try{ await Messages.deleteByChat(Number(r.bot_id), Number(r.dest_chat_id)); }catch(_m){}
                try{ await Chats.deleteByChat(Number(r.bot_id), Number(r.dest_chat_id)); }catch(_c){}
              }catch(_e){}
            }
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
            const sid = Number(r.source_chat_id);
            if (!existing.has(sid) && r.enabled){
              const misses = incSourceMiss(Number(r.device_id), sid);
              if (misses >= MISS_THRESHOLD){
                try{ await RouteRules.disableBySource(Number(r.device_id), sid); }catch(_e){}
              }
            } else {
              // present -> reset miss counter
              resetSourceMiss(Number(r.device_id), sid);
            }
          }
        }catch(_e){}
      }
    }catch(_e){}
  }, AUDIT_MS).unref?.();
}

module.exports = { init };
