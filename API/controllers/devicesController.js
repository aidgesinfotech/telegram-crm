const mt = require('../services/mtprotoService');
const db = require('../config/db');
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

// Maintenance: clear rows from all tables except site configuration and users
exports.resetAll = async (req, res) => {
  try{
    // determine current schema
    const [dbRow] = await db.execute('SELECT DATABASE() AS db');
    const schema = (dbRow && dbRow[0] && dbRow[0].db) ? dbRow[0].db : null;
    if (!schema) return res.status(500).json({ error: 'Cannot determine schema' });

    // tables to preserve (case-insensitive)
    const keep = new Set(['users', 'site_configurations', 'site_configuration', 'siteconfig', 'site_config']);

    const [tables] = await db.execute(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`, [schema]
    );

    let cleared = [];
    for (const t of (tables || [])){
      const name = String(t.table_name || t.TABLE_NAME || '').trim();
      if (!name) continue;
      if (keep.has(name.toLowerCase())) continue;
      try {
        await db.execute(`DELETE FROM \`${name}\``);
        cleared.push(name);
      } catch(_e) {
        // fallback attempt: disable fk for delete
        try{
          await db.execute('SET FOREIGN_KEY_CHECKS=0');
          await db.execute(`DELETE FROM \`${name}\``);
        }catch(__e){} finally { try{ await db.execute('SET FOREIGN_KEY_CHECKS=1'); }catch(__e2){} }
      }
    }
    return res.status(200).json({ status: 'ok', cleared });
  }catch(e){
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

exports.dialogs = async (req, res) => {
  try{
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    // attach handler to ensure client is connected
    try{ await mt.ensureUpdateHandler(id); }catch(_e){}
    const items = await mt.listDialogs(id);
    return res.status(200).json({ status: 'success', data: items });
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
    // trigger background sync after successful login
    try { mt.ensureUpdateHandler(Number(deviceId)).catch(()=>{}); } catch(_e){}
    try { mt.syncDialogs(Number(deviceId)).catch(()=>{}); } catch(_e){}
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
    // trigger background sync after successful 2FA
    try { mt.ensureUpdateHandler(Number(deviceId)).catch(()=>{}); } catch(_e){}
    try { mt.syncDialogs(Number(deviceId)).catch(()=>{}); } catch(_e){}
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
