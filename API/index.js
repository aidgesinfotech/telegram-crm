require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { initSocket } = require('./config/socket');

const fileuploadRoutes = require("./routes/fileuploadRoutes");

const usersRoutes = require('./routes/usersRoutes');
const rolesRoutes = require('./routes/rolesRoutes');
const permissionsRoutes = require('./routes/permissionsRoutes');
const pagesRoutes = require('./routes/pagesRoutes');
const pagescategoryRoutes = require('./routes/pagescategoryRoutes');
const siteconfigRoutes = require('./routes/siteconfigRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const bannerRoutes = require('./routes/bannerRoutes');
const botsRoutes = require('./routes/botsRoutes');
const chatsRoutes = require('./routes/chatsRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const devicesRoutes = require('./routes/devicesRoutes');
const routeRulesRoutes = require('./routes/routeRulesRoutes');

const { runMigrations } = require('./config/migrations');
const TelegramService = require('./services/telegramService');
const RouterService = require('./services/routerService');

const app = express();
const PORT = process.env.PORT || 3000;  
const server = http.createServer(app);

// CORS options
const corsOptions = {
  origin: '*', // If you want any URL then use '*'
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};

// Use CORS middleware with options
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));

// health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use("/api/file", fileuploadRoutes);

app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/pages', pagesRoutes);
app.use('/api/pagescategory', pagescategoryRoutes);
app.use('/api/siteconfig', siteconfigRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api/banner', bannerRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/rules', routeRulesRoutes);

// init socket.io
initSocket(server);

server.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  try {
    await runMigrations();
    await TelegramService.init();
    await RouterService.init();
    console.log('Migrations completed and Telegram bots initialized');
  } catch (e) {
    console.error('Startup init failed:', e.message || e);
  }
});