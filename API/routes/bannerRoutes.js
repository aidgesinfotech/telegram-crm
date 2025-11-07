const express = require('express');
const router = express.Router();
const BannersController = require('../controllers/bannerController');

router.post('/createBanner', BannersController.createBanner);
router.get('/getAllBanners', BannersController.getAllBanners);
router.put('/updateBanner/:id', BannersController.updateBanner);
router.delete('/deleteBanner/:id', BannersController.deleteBanner);

module.exports = router;