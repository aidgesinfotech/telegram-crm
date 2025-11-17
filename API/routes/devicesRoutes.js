const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const devicesController = require('../controllers/devicesController');

router.get('/list', auth, devicesController.list);
router.get('/dialogs/:id', auth, devicesController.dialogs);
router.get('/status/:id', auth, devicesController.status);
router.post('/startLogin', auth, devicesController.startLogin);
router.post('/submitCode', auth, devicesController.submitCode);
router.post('/submitPassword', auth, devicesController.submitPassword);
router.post('/deactivate/:id', auth, devicesController.deactivate);
router.delete('/delete/:id', auth, devicesController.delete);
router.post('/resetAll', auth, devicesController.resetAll);

module.exports = router;
