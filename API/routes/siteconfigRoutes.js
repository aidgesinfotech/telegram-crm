const express = require('express');
const router = express.Router();
const SiteconfigsController = require('../controllers/siteconfigController');
const { auth } = require('../middlewares/auth.js');

router.post('/createSiteconfig',auth, SiteconfigsController.createSiteconfig);
router.get('/getSiteconfig', SiteconfigsController.getAllSiteconfigs);
router.put('/updateSiteconfig/:id',auth, SiteconfigsController.updateSiteconfig);
router.delete('/deleteSiteconfig/:id',auth, SiteconfigsController.deleteSiteconfig);

module.exports = router;