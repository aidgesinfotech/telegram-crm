const Bots = require('../models/botsModel');
const TelegramService = require('../services/telegramService');

exports.createBot = async (req, res) => {
  try {
    const result = await Bots.create(req.body);
    // Start bot if active
    if (req.body.is_active) {
      await TelegramService.startBot(result.data.insertId, req.body.token, req.body.name);
    }
    res.status(201).json({ message: 'Bot created', id: result.data.insertId });
  } catch (err) {
    console.error('Error creating bot:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllBots = async (req, res) => {
  try {
    const results = await Bots.getAll();
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching bots:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getBotByUsername = async (req, res) => {
  try {
    const username = req.params.username;
    const bot = await Bots.getByUsername(username);
    if (!bot) return res.status(404).json({ status: 'not_found' });
    res.status(200).json({ status: 'success', data: bot });
  } catch (err) {
    console.error('Error fetching bot by username:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateBot = async (req, res) => {
  const id = req.params.id;
  try {
    const existing = await Bots.getById(id);
    await Bots.update(id, req.body);
    if (existing && existing.is_active && !req.body.is_active) {
      await TelegramService.stopBot(id);
    } else if ((!existing || !existing.is_active) && req.body.is_active) {
      await TelegramService.startBot(id, req.body.token, req.body.name);
    } else if (req.body.token && existing && existing.token !== req.body.token && req.body.is_active) {
      await TelegramService.restartBot(id, req.body.token, req.body.name);
    }
    res.status(200).json({ message: 'Bot updated' });
  } catch (err) {
    console.error('Error updating bot:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteBot = async (req, res) => {
  const id = req.params.id;
  try {
    await TelegramService.stopBot(id);
    await Bots.delete(id);
    res.status(200).json({ message: 'Bot deleted' });
  } catch (err) {
    console.error('Error deleting bot:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.sendBulk = async (req, res) => {
  try {
    const { bot_id, targets, text } = req.body;
    const result = await TelegramService.sendBulkMessages(bot_id, targets, text);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    console.error('Error bulk send:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Telegram getWebhookInfo for a bot
exports.webhookInfo = async (req, res) => {
  try{
    const botId = Number(req.params.id);
    if (!botId) return res.status(400).json({ error: 'Missing id' });
    const info = await TelegramService.getWebhookInfo(botId);
    return res.status(200).json({ status: 'success', data: info });
  }catch(e){
    console.error('Error webhookInfo:', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Internal server error' });
  }
};

// Register webhook for a bot using env PUBLIC_URL/TG_SECRET
exports.registerWebhook = async (req, res) => {
  try{
    const botId = Number(req.params.id);
    if (!botId) return res.status(400).json({ error: 'Missing id' });
    const out = await TelegramService.registerWebhook(botId);
    return res.status(200).json({ status: 'success', data: out });
  }catch(e){
    console.error('Error registerWebhook:', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Internal server error' });
  }
};

// Restart bot instance and re-register webhook
exports.restartAndRegister = async (req, res) => {
  try{
    const botId = Number(req.params.id);
    if (!botId) return res.status(400).json({ error: 'Missing id' });
    const out = await TelegramService.restartAndRegister(botId);
    return res.status(200).json({ status: 'success', data: out });
  }catch(e){
    console.error('Error restartAndRegister:', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Internal server error' });
  }
};
