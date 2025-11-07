const express = require('express');
const router = express.Router();
const PagesController = require('../controllers/pagesController');
const { auth } = require('../middlewares/auth.js');

router.post('/createPage',auth, PagesController.createPage);
router.get('/getAllPages',auth, PagesController.getAllPages);
router.get('/getAllPagesByPage',auth, PagesController.getAllPagesByPage);
router.put('/updatePage/:id',auth, PagesController.updatePage);
router.delete('/deletePage/:id',auth, PagesController.deletePage);

module.exports = router;
