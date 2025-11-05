// Vercel Serverless Function: scheduled via vercel.json crons
// Pings your Render API to prevent sleep

export default async function handler(req, res) {
  try {
    const target = ""; // e.g., https://api.yourdomain.com/health
    if (!target) {
      return res.status(500).json({ error: 'TARGET_URL env not set' });
    }
    const r = await fetch(target, { method: 'GET', headers: { 'User-Agent': 'Heartbeat/1.0' } });
    const ok = r.ok;
    const text = await r.text().catch(() => '');
    return res.status(200).json({ ok, status: r.status, target, snippet: text.slice(0, 200) });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
