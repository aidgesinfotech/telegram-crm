const db = require('../config/db');

const Permissions = {
  create: async (data) => {
    const sql = 'INSERT INTO permissions (roleid, pageid, action, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())';
    try {
      const [results] = await db.execute(sql, [data.roleid, data.pageid, data.action]);

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
      const [results] = await db.execute('SELECT * FROM permissions');

      let dataJSON = {
        status: 'success',
        data: results
      }
      return dataJSON;
    } catch (err) {
      throw err;
    }
  },

  getPermissionsByRole: async (roleId) => {
    try {
      const [results] = await db.execute('SELECT * FROM permissions WHERE roleId = ?', [roleId]);

      let dataJSON = {
        status: 'success',
        data: results
      };
      return dataJSON;
    } catch (err) {
      throw err;
    }
  },

  update: async (id, data) => {
    const sql = 'UPDATE permissions SET roleid = ?, pageid = ?, action = ?, updated_at = NOW() WHERE id = ?';
    try {
      const [results] = await db.execute(sql, [data.roleid, data.pageid, data.action, id]);

      let dataJson = {
        status: 'success',
        data: results
      }
      return dataJson;
    } catch (err) {
      throw err;
    }
  },

  updateByRole: async (roleId, data) => {
    const selectSql = 'SELECT permissionid, pageid, action FROM permissions WHERE roleid = ?';
  
    try {
      const [permissions] = await db.execute(selectSql, [roleId]);
      
      const existingPageIds = permissions.map(permission => permission.pageid);
  
      const insertSql = 'INSERT INTO permissions (roleid, pageid, action, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())';
      const updateSql = 'UPDATE permissions SET action = ?, updated_at = NOW() WHERE roleid = ? AND pageid = ?';
  
      for (let permissionData of data) {
        if (existingPageIds.includes(permissionData.pageid)) {
          await db.execute(updateSql, [permissionData.action, roleId, permissionData.pageid]);
        } else {
          await db.execute(insertSql, [roleId, permissionData.pageid, permissionData.action]);
        }
      }
  
      return { status: 'success', message: 'Permissions processed successfully' };
    } catch (err) {
      throw err;
    }
  },


  delete: async (id) => {
    try {
      const [results] = await db.execute('DELETE FROM permissions WHERE id = ?', [id]);
      return results;
    } catch (err) {
      throw err;
    }
  },
};

module.exports = Permissions;
