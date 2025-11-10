const db = require('../config/db');

const Pages = {
  create: async (data,userDetails) => {
    const sql = 'INSERT INTO pages (pagename, displayorder, url, icon,categoryId, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())';
    try {
      const [results] = await db.execute(sql, [data.pagename, data.displayorder, data.url, data.icon, data.categoryId]);
      
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

      const [results] = await db.execute(`
        SELECT 
          pages.*, 
          pagescategory.name AS categoryName
        FROM pages
        LEFT JOIN pagescategory ON pages.categoryId = pagescategory.id
        ORDER BY pages.created_at DESC
      `);
      
      let dataJSON = {
        status: 'success',
        data: results
    }
      return dataJSON;
    } catch (err) {
      throw err;
    }
  },
  
  getAllByPage: async (limit, pageNo, searchtxt) => {
    try {
      const offset = (pageNo - 1) * limit;
  
      let query = `
        SELECT 
          pages.*, 
          pagescategory.name AS categoryName
        FROM pages
        LEFT JOIN pagescategory ON pages.categoryId = pagescategory.id
      `;
      let queryParams = [];
  
      if (searchtxt) {
        const columns = ['pagename'];
        const searchConditions = columns.map(col => `${col} LIKE ?`).join(' OR ');
        query += ` WHERE ${searchConditions}`;
        queryParams = columns.map(() => `%${searchtxt}%`);
      }
  
      query += ' ORDER BY pages.created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);
  
      const [results] = await db.execute(query, queryParams);
  
      const [totalCountResults] = await db.execute('SELECT COUNT(*) AS totalCount FROM pages');
      const totalCount = totalCountResults[0].totalCount;
  
      return {
        status: 'success',
        data: results,
        totalCount: totalCount
      };
    } catch (err) {
      throw err;
    }
  },  


  update: async (id, data,userDetails) => {
    const sql = 'UPDATE pages SET pagename = ?, displayorder = ?,categoryId = ?, url = ?, icon = ?, updated_at = NOW() WHERE pageId = ?';
    try {
      const [results] = await db.execute(sql, [data.pagename, data.displayorder, data.categoryId, data.url, data.icon, id]);
      
      
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
      const [results] = await db.execute('DELETE FROM pages WHERE pageId = ?', [id]);
      
      return results;
    } catch (err) {
      throw err;
    }
  },
};

module.exports = Pages;