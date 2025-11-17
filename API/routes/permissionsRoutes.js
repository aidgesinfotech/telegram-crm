const express = require('express');
const router = express.Router();
const PermissionsController = require('../controllers/permissionsController');
const { auth } = require('../middlewares/auth.js');

router.post('/createPermission',auth, PermissionsController.createPermission);
router.get('/getAllPermissions',auth, PermissionsController.getAllPermissions);
router.get('/getPermissionsByRole/:roleId',auth, PermissionsController.getPermissionsByRole);
router.put('/updatePermissionsByRole/:roleid',auth, PermissionsController.updatePermissionByRole);
router.put('/updatePermission/:id',auth, PermissionsController.updatePermission);
router.delete('/deletePermission/:id',auth, PermissionsController.deletePermission);

module.exports = router;
