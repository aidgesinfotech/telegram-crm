const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const ctrl = require('../controllers/routeRulesController');

router.post('/', auth, ctrl.create);
router.get('/device/:device_id', auth, ctrl.listByDevice);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.remove);
router.post('/test', auth, ctrl.testRoute);

module.exports = router;
