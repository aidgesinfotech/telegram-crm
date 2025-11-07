const Dashboard = require('../models/dashboardModel');

exports.superadminDashboard = async (req, res) => {
  try {
    const results = await Dashboard.superadminDashboard();
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching Dashboard:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};