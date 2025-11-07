const mt = require('../services/mtprotoService');
const Devices = require('../models/devicesModel');
const DeviceSessions = require('../models/deviceSessionsModel');

exports.list = async (req, res) => {
  try{
    const rows = await mt.list();
    res.status(200).json({ status: 'success', data: rows });
  }catch(e){
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

exports.dialogs = async (req, res) => {
  try{
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    // attach handler to ensure client is connected
    try{ await mt.ensureUpdateHandler(id); }catch(_e){}
    const items = await mt.listDialogs(id);
    res.status(200).json({ status: 'success', data: items });
  }catch(e){
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

exports.status = async (req, res) => {
  try{
    const id = Number(req.params.id);
    const s = await mt.status(id);
    res.status(200).json(s);
  }catch(e){
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

exports.startLogin = async (req, res) => {
  try{
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const r = await mt.startLogin(String(phone));
    res.status(200).json(r);
  }catch(e){
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

exports.submitCode = async (req, res) => {
  try{
    const { deviceId, code } = req.body || {};
    if (!deviceId || !code) return res.status(400).json({ error: 'deviceId and code required' });
    const r = await mt.submitCode(Number(deviceId), String(code));
    res.status(200).json(r);
  }catch(e){
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

exports.submitPassword = async (req, res) => {
  try{
    const { deviceId, password } = req.body || {};
    if (!deviceId || !password) return res.status(400).json({ error: 'deviceId and password required' });
    const r = await mt.submitPassword(Number(deviceId), String(password));
    res.status(200).json(r);
  }catch(e){
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

exports.deactivate = async (req, res) => {
  try{
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await mt.deactivate(id);
    res.status(200).json(r);
  }catch(e){
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

exports.delete = async (req, res) => {
  try{
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const existing = await Devices.getById(id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    // Best-effort deactivate/cleanup on MTProto side if available
    try { await mt.deactivate(id); } catch(_e) {}
    // Remove sessions then device
    await DeviceSessions.deleteByDevice(id);
    await Devices.delete(id);
    res.status(200).json({ status: 'ok' });
  }catch(e){
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};
