require('dotenv').config();
const mysql = require('mysql2');

// Create a connection pool with keep-alive to reduce idle disconnects
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 15000
});

const p = pool.promise();

function isTransient(err) {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  return code === 'ECONNRESET' ||
         code === 'PROTOCOL_CONNECTION_LOST' ||
         code === 'ETIMEDOUT' ||
         code === 'EPIPE' ||
         code === 'ECONNABORTED';
}

async function backoff(ms){ return new Promise(r => setTimeout(r, ms)); }

async function execWithRetry(kind, sql, params = [], attempts = 3){
  let lastErr;
  let delay = 120; // ms
  for (let i = 0; i < attempts; i++) {
    try {
      if (kind === 'execute') return await p.execute(sql, params);
      return await p.query(sql, params);
    } catch (e) {
      lastErr = e;
      if (!isTransient(e) || i === attempts - 1) break;
      await backoff(delay);
      delay = Math.min(delay * 2, 800);
    }
  }
  throw lastErr;
}

module.exports = {
  execute: (sql, params) => execWithRetry('execute', sql, params),
  query: (sql, params) => execWithRetry('query', sql, params),
  getPool: () => pool
};
