const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/rolesController');
const { auth } = require('../middlewares/auth.js');

router.post('/createRole', auth , rolesController.createRole);
router.get('/getAllRoles', auth , rolesController.getAllRoles);
router.put('/updateRole/:id', auth , rolesController.updateRole);
router.delete('/deleteRole/:id', auth , rolesController.deleteRole);

module.exports = router;