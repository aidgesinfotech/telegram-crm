// Simple heartbeat script: pings the Render API health endpoint every 30 seconds
// Note: This requires a persistent runtime (e.g., a VM, Render/Railway service, PM2, etc.)
// Vercel serverless won’t keep this process running in the background.

const https = require('https');
const url = 'https://telegram-crm.onrender.com/health';

function ping() {
  const start = Date.now();
  try {
    https
      .get(url, { headers: { 'User-Agent': 'Heartbeat/1.0' } }, (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const ms = Date.now() - start;
          const body = Buffer.concat(chunks).toString('utf8');
          const snippet = body.slice(0, 200).replace(/\s+/g, ' ');
          console.log(`[Heartbeat] ${new Date().toISOString()} status=${res.statusCode} time=${ms}ms body=${snippet}`);
        });
      })
      .on('error', (e) => {
        console.error(`[Heartbeat] ${new Date().toISOString()} error:`, e.message);
      });
  } catch (e) {
    console.error(`[Heartbeat] ${new Date().toISOString()} error:`, e.message);
  }
}

// Kick off immediately, then every 30s
ping();
setInterval(ping, 10 * 1000);
