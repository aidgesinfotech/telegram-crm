const db = require('../config/db');

const files = {
    createFormUpload: async (data) => {
        const sql = 'INSERT INTO files (url, directory, created_at) VALUES (?, ?, NOW())';
        try {
            let results;
            results = await db.execute(sql, [data.url, data.directory]);
            
            let dataJSON = {
                status: 'success',
                data: results
            }

            return dataJSON;
        } catch (err) {
            throw err;
        }
    },
    getFilesByPath: async (path) => {
        try {
            const [results] = await db.execute(`SELECT * FROM files WHERE files.directory = ? ORDER BY created_at DESC`, [path]);
    
            if (results.length === 0) {
                return {
                    status: 'error',
                    message: 'File not found'
                };
            }
    
            const [countResult] = await db.execute(`SELECT COUNT(*) AS totalCount FROM files WHERE storeId = ?`, [storeId]);
            
            return {
                status: 'success',
                data: results,
                totalCount: countResult[0].totalCount
            };
        } catch (err) {
            throw err;
        }
    }    
}

module.exports = files;