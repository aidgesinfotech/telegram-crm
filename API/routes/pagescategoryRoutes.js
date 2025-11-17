const express = require('express');
const router = express.Router();
const PagesCategorysController = require('../controllers/pagescategoryController');
const { auth } = require('../middlewares/auth.js');

router.post('/createPagesCategory',auth, PagesCategorysController.createPagecategory);
router.get('/getAllPagesCategory',auth, PagesCategorysController.getAllPagecategorys);
router.get('/getAllPageCategorysByPage',auth, PagesCategorysController.getAllPageCategorysByPage);
router.put('/updatePagesCategory/:id',auth, PagesCategorysController.updatePagecategory);
router.delete('/deletePagesCategory/:id',auth, PagesCategorysController.deletePagecategory);

module.exports = router;
