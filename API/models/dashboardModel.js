const db = require('../config/db');

const Dashboard = {
  superadminDashboard: async () => {
    try {
      const [[bots]] = await db.execute(`SELECT COUNT(*) AS row_count FROM bots`);
      const [[users]] = await db.execute(`SELECT COUNT(*) AS row_count FROM users`);
      const [[activeUsers]] = await db.execute(`SELECT COUNT(*) AS row_count FROM users WHERE isActive = 1`);

      // Users created in the last 7 days (including today)
      const [rows] = await db.execute(`
        SELECT DATE(created_at) AS d, COUNT(*) AS c
        FROM users
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(created_at)
        ORDER BY d ASC
      `);

      // Build continuous 7-day series
      const series = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const y = date.getFullYear();
        const m = `${date.getMonth() + 1}`.padStart(2, '0');
        const d = `${date.getDate()}`.padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        const found = rows.find(r => {
          const dt = new Date(r.d);
          const fy = dt.getFullYear();
          const fm = `${dt.getMonth() + 1}`.padStart(2, '0');
          const fd = `${dt.getDate()}`.padStart(2, '0');
          return `${fy}-${fm}-${fd}` === key;
        });
        series.push({ date: key, count: found ? Number(found.c) : 0 });
      }

      const dashboardJson = [
        {
          totalBots: Number(bots.row_count) || 0,
          totalUsers: Number(users.row_count) || 0,
          activeUsers: Number(activeUsers.row_count) || 0,
          usersLast7d: series,
        }
      ];

      return {
        status: 'success',
        data: dashboardJson
      };
    } catch (err) {
      throw err;
    }
  },
};

module.exports = Dashboard;