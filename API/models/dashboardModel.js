const db = require('../config/db');

const Dashboard = {
  superadminDashboard: async () => {
    try {
      const [[bots]] = await db.execute(`SELECT COUNT(*) AS row_count FROM bots`);
      const [[users]] = await db.execute(`SELECT COUNT(*) AS row_count FROM users`);
      const [[activeUsers]] = await db.execute(`SELECT COUNT(*) AS row_count FROM users WHERE isActive = 1`);

      // Active bots (if bots table has is_active flag, otherwise fallback to total)
      let activeBotsCount = bots.row_count;
      try{
        const [[activeBots]] = await db.execute(`SELECT COUNT(*) AS row_count FROM bots WHERE is_active = 1`);
        activeBotsCount = Number(activeBots.row_count) || 0;
      }catch(_e){ activeBotsCount = Number(bots.row_count) || 0; }

      // New users today
      const [[newUsersToday]] = await db.execute(`SELECT COUNT(*) AS row_count FROM users WHERE DATE(created_at) = CURDATE()`);

      // Messages stats (today and last 24h) if messages table exists
      let messagesTodayCount = 0;
      let messages24hCount = 0;
      try{
        const [[mToday]] = await db.execute(`SELECT COUNT(*) AS row_count FROM messages WHERE DATE(created_at) = CURDATE()`);
        const [[m24h]] = await db.execute(`SELECT COUNT(*) AS row_count FROM messages WHERE created_at >= (NOW() - INTERVAL 1 DAY)`);
        messagesTodayCount = Number(mToday.row_count) || 0;
        messages24hCount = Number(m24h.row_count) || 0;
      }catch(_e){ /* messages table might not exist yet; keep zeros */ }

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
          activeBots: Number(activeBotsCount) || 0,
          newUsersToday: Number(newUsersToday.row_count) || 0,
          messagesToday: Number(messagesTodayCount) || 0,
          messages24h: Number(messages24hCount) || 0,
          // Placeholder fields for future enhancements
          conversions: 0,
          conversionsToday: 0,
          errorsToday: 0,
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