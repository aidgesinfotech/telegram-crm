const db = require('../config/db');
const ftp = require("basic-ftp");
const streamifier = require('streamifier'); 
const fs = require("fs");
const FileModel = require("../models/fileuploadModel");
const Files = require("../models/filesModel");
const config = require("../config/config");

async function uploadFile(req, res) {
    // Check if the file is properly uploaded and req.body.dirName exists
    if (!req.file || !req.body.dirName) {
        return res.status(400).json({ message: "No file or directory name provided" });
    }

    const client = new ftp.Client();
    client.ftp.verbose = true;

    const directoryName = req.body.dirName;
    const timestamp = Date.now(); // Get current timestamp
    const fileExtension = req.file.originalname.split('.').pop(); // Get file extension
    const fileName = `${timestamp}.${fileExtension}`; // Create timestamp-based filename
    const remoteDir = `${config.uploadDir}${directoryName}/`;
    const remotePath = `${remoteDir}${fileName}`;

    try {
        await client.access({
            host: config.ftp.host,
            user: config.ftp.user,
            password: config.ftp.password,
            secure: config.ftp.secure
        });

        await client.ensureDir(remoteDir);

        // Create a readable stream from the buffer
        const fileStream = streamifier.createReadStream(req.file.buffer);

        // Upload the file directly from the readable stream to the FTP server
        await client.uploadFrom(fileStream, remotePath);

        const fileUrl = `https://${config.ftp.baseURL}/${directoryName}/${fileName}`;
        const fileDetails = new FileModel(fileName, req.file.mimetype, fileUrl);

        const result = await Files.createFormUpload({ url: fileUrl, directory: directoryName }, req.userDetails);

        res.status(200).json({ 
            message: "File uploaded successfully", 
            file: fileDetails, 
            fileId: result.data[0].insertId, 
            dbRecord: result 
        });

    } catch (err) {
        console.error("FTP Upload Error:", err);
        res.status(500).json({ 
            message: "FTP Upload Failed", 
            error: err.message 
        });
    } finally {
        client.close();
    }
}

async function deleteFile(req, res) {
    const { fileId } = req.params;

    if (!fileId) {
        return res.status(400).json({ message: "File ID is required" });
    }

    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
        const [imageDetails] = await db.execute('SELECT * FROM files WHERE id = ?', [fileId]);

        if (!imageDetails.length) {
            return res.status(404).json({ message: "Image not found" });
        }

        const image = imageDetails[0];
        const remotePath = image.url.replace(`https://${config.ftp.baseURL}/`, '');

        await client.access({
            host: config.ftp.host,
            user: config.ftp.user,
            password: config.ftp.password,
            secure: config.ftp.secure
        });

        await client.remove(remotePath);

        await db.execute('DELETE FROM files WHERE id = ?', [fileId]);

        res.status(200).json({ message: "File deleted successfully" });
    } catch (err) {
        console.error("Error deleting file:", err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    } finally {
        client.close();
    }
}

async function listFoldersAtPath(client, directoryPath) {
    try {
       
        const fileList = await client.list(directoryPath);

       
        const directories = fileList.filter(file => file.isDirectory);

       
        return directories.map(dir => ({
            name: dir.name,
            path: `${directoryPath}/${dir.name}`
        }));
    } catch (err) {
        console.error("Error listing directories:", err);
        throw err;
    }
}

async function listFolders(req, res) {
    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
       
        const { path } = req.body;

        if (!path) {
            return res.status(400).json({ message: "Path is required." });
        }
        await client.access({
            host: config.ftp.host,
            user: config.ftp.user,
            password: config.ftp.password,
            secure: config.ftp.secure
        });
        const folders = await listFoldersAtPath(client, `/public_html/${path}`);

       
        res.status(200).json({ folders });

    } catch (err) {
        console.error("Error listing folders:", err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    } finally {
        client.close();
    }
}

async function getFilesByPath(req, res) {
    const path = req.body.path;
    try {
        const results = await Files.getFilesByPath(path, req.userDetails);
        res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching Files:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { uploadFile , deleteFile , listFolders , getFilesByPath };