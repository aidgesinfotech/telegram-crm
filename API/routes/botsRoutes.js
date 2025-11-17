const express = require('express');
const router = express.Router();
const BotsController = require('../controllers/botsController');

router.post('/createBot', BotsController.createBot);
router.get('/getAllBots', BotsController.getAllBots);
router.get('/getBotByUsername/:username', BotsController.getBotByUsername);
router.put('/updateBot/:id', BotsController.updateBot);
router.delete('/deleteBot/:id', BotsController.deleteBot);
router.post('/sendBulk', BotsController.sendBulk);

// Webhook utilities
router.get('/webhookInfo/:id', BotsController.webhookInfo);
router.post('/registerWebhook/:id', BotsController.registerWebhook);
router.post('/restartAndRegister/:id', BotsController.restartAndRegister);

module.exports = router;
