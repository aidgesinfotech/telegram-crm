const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');

router.get('/global', AnalyticsController.getGlobalSummary);
router.get('/bot/:botId', AnalyticsController.getBotSummary);

module.exports = router;
