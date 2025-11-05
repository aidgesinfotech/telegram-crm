// Vercel serverless handler: responds 200 with success text and optional ping result
// Note: background intervals are not supported on serverless. Use an external cron to hit this endpoint.

async function doPing(target) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(target, { method: 'GET', headers: { 'User-Agent': 'Heartbeat/1.0' }, signal: controller.signal });
    clearTimeout(timeout);
    const text = await r.text().catch(() => '');
    return { ok: r.ok, status: r.status, ms: Date.now() - start, snippet: text.slice(0, 200) };
  } catch (e) {
    return { ok: false, error: e.message, ms: Date.now() - start };
  }
}

module.exports = async (req, res) => {
  const target = process.env.TARGET_URL || 'https://telegram-crm.onrender.com/health';
  const doHeartbeat = req.method === 'GET' || req.method === 'POST';
  let ping = null;
  if (doHeartbeat) {
    ping = await doPing(target);
  }
  // Always 200; human-friendly message
  const message = 'Project running successfully!';
  const body = { message, target, ping };
  // If client wants plain text
  if ((req.headers['accept'] || '').includes('text/html') || req.url === '/' ) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(`${message}\nTarget: ${target}\nPing: ${JSON.stringify(ping)}`);
  }
  res.status(200).json(body);
};
