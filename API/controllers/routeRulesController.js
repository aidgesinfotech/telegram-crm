const RouteRules = require('../models/routeRulesModel');
const TelegramService = require('../services/telegramService');

exports.create = async (req, res) => {
  try{
    const { device_id, source_chat_id, bot_id, dest_chat_id, title, filters_json, transforms_json, enabled } = req.body || {};
    if (!device_id || !source_chat_id || !bot_id || !dest_chat_id){
      return res.status(400).json({ error: 'device_id, source_chat_id, bot_id, dest_chat_id required' });
    }
    const r = await RouteRules.create({ device_id, source_chat_id, bot_id, dest_chat_id, title, filters_json, transforms_json, enabled: enabled!==false });
    res.status(201).json({ status: 'success', id: r.id });
  }catch(e){ res.status(500).json({ error: e.message || 'Internal server error' }); }
};

exports.listByDevice = async (req, res) => {
  try{
    const device_id = Number(req.params.device_id);
    if (!device_id) return res.status(400).json({ error: 'device_id required' });
    const rows = await RouteRules.listByDevice(device_id);
    res.status(200).json({ status: 'success', data: rows });
  }catch(e){ res.status(500).json({ error: e.message || 'Internal server error' }); }
};

exports.update = async (req, res) => {
  try{
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const patch = req.body || {};
    const r = await RouteRules.update(id, patch);
    res.status(200).json({ status: 'success', affected: r.affectedRows || 0 });
  }catch(e){ res.status(500).json({ error: e.message || 'Internal server error' }); }
};

exports.remove = async (req, res) => {
  try{
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await RouteRules.delete(id);
    res.status(200).json({ status: 'success', affected: r.affectedRows || 0 });
  }catch(e){ res.status(500).json({ error: e.message || 'Internal server error' }); }
};

// Simple test endpoint to verify bot can post into destination
exports.testRoute = async (req, res) => {
  try{
    const { bot_id, dest_chat_id, text } = req.body || {};
    if (!bot_id || !dest_chat_id) return res.status(400).json({ error: 'bot_id and dest_chat_id required' });
    const msg = await TelegramService.sendMessageOne(Number(bot_id), Number(dest_chat_id), String(text || 'Route test ✅'));
    res.status(200).json({ status: 'success', message: msg });
  }catch(e){ res.status(500).json({ error: e.message || 'Internal server error' }); }
};
