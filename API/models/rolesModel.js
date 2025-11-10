const db = require('../config/db');

const Roles = {
  create: async (data,userDetails) => {
    const sql = 'INSERT INTO roles (roleName, created_at, updated_at) VALUES (?, NOW(), NOW())';
    try {
      const [results] = await db.execute(sql, [data.roleName]);
      
      let dataJSON = {
        status: 'success',
        data: results
    }
      return dataJSON;
    } catch (err) {
      throw err;
    }
  },
  
  getAll: async () => {
    try {
      const [results] = await db.execute('SELECT * FROM roles ORDER BY created_at DESC');
      
      let dataJSON = {
        status: 'success',
        data: results
    }
      return dataJSON;
    } catch (err) {
      throw err;
    }
  },  

  update: async (id, data,userDetails) => {
    const sql = 'UPDATE roles SET roleName = ?, updated_at = NOW() WHERE id = ?';
    try {
      const [results] = await db.execute(sql, [data.roleName, id]);
      
      let dataJson = {
        status: 'success',
        data: results
    }
      return dataJson;
    } catch (err) {
      throw err;
    }
  },

  delete: async (id,userDetails) => {
    try {
      const [results] = await db.execute('DELETE FROM roles WHERE id = ?', [id]);
      
      return results;
    } catch (err) {
      throw err;
    }
  },
};

module.exports = Roles;
