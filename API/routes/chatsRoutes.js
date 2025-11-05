const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const ChatsController = require('../controllers/chatsController');

router.get('/list/:botId', ChatsController.getChats);
router.get('/members/:botId/:chatId', ChatsController.getMembers);
router.get('/messages/:botId/:chatId', ChatsController.getMessages);
router.get('/file/:botId/:fileId', ChatsController.streamFile);
router.get('/count/:botId/:chatId', ChatsController.getCount);
router.post('/sendMessage', ChatsController.sendMessage);
router.post('/sendMedia', upload.single('file'), ChatsController.sendMedia);
router.post('/sendComposite', upload.single('file'), ChatsController.sendComposite);
router.post('/sendPoll', ChatsController.sendPoll);
router.post('/sendChecklist', ChatsController.sendChecklist);
router.post('/sendButtons', ChatsController.sendButtons);
router.post('/clearChat', ChatsController.clearChat);
router.post('/deleteMessages', ChatsController.deleteMessages);
router.post('/forwardMessages', ChatsController.forwardMessages);
router.post('/react', ChatsController.reactMessage);
router.post('/replyMessage', ChatsController.replyMessage);
router.post('/editMessage', ChatsController.editMessage);
router.post('/pin', ChatsController.pinMessage);
router.post('/unpin', ChatsController.unpinMessage);
router.post('/setChatTitle', ChatsController.setChatTitle);

module.exports = router;
