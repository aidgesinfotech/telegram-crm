const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { auth } = require('../middlewares/auth.js');

router.post('/createUser',auth, usersController.createUser);
router.get('/getAllUsers',auth, usersController.getAllUsers);
router.get('/getAllUsersByPage',auth, usersController.getAllUsersByPage);
router.post('/loginUser', usersController.loginUser);
router.put('/updateUser/:id',auth, usersController.updateUser);
router.put('/updateUserStatus/:id',auth, usersController.updateUserStatus);
router.delete('/deleteUser/:id',auth, usersController.deleteUser);

module.exports = router;