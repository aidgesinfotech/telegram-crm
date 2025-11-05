const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');

router.post('/webhook/:botId', telegramController.webhook);

module.exports = router;
