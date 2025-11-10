const express = require("express");
const multer = require("multer");
const { uploadFile , deleteFile , listFolders , getFilesByPath } = require("../controllers/fileuploadController");
const { auth } = require('../middlewares/auth.js');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), uploadFile);
router.delete('/deleteFile/:fileId', deleteFile);
router.post('/getFoldersByPath' , listFolders);
router.post('/getFilesByPath' , getFilesByPath);

module.exports = router;