import http from 'node:http';
import { once } from 'node:events';

// Owned deterministic upstream for integration tests; never used by normal dev/start.
export async function startBinanceStub() {
  const state = { requests: 0, failNext: 0, mode: 'normal' };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/__control') {
      if (req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        Object.assign(state, JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      }
      res.end(JSON.stringify(state));
      return;
    }
    if (url.pathname !== '/api/v3/klines') { res.writeHead(404).end('{}'); return; }
    state.requests++;
    if (state.failNext > 0) { state.failNext--; res.writeHead(429).end(JSON.stringify({ code: -1003, msg: 'Controlled rate limit' })); return; }
    const interval = { '1h': 3600000, '4h': 14400000, '1d': 86400000 }[url.searchParams.get('interval')] ?? 3600000;
    const limit = Math.min(1000, Number(url.searchParams.get('limit') ?? 500));
    const end = Number(url.searchParams.get('endTime') ?? Date.now());
    const start = url.searchParams.has('startTime') ? Number(url.searchParams.get('startTime')) : Math.floor(end / interval) * interval - (limit - 1) * interval;
    const prices = [100,104,110,120,117,113,110,112,119,130,150,145,137,130,137,149,155,146,138,140];
    const rows = [];
    for (let time = Math.ceil(start / interval) * interval; time <= end && rows.length < limit; time += interval) {
      const index = Math.floor(time / interval) % prices.length;
      const price = prices[index];
      rows.push([time, String(price + 1), String(price + 3), String(price - 2), String(price + 2), '100', time + interval - 1, '10000', 42, '50', '5000', '0']);
    }
    if (state.mode === 'malformed') res.end(JSON.stringify([[1, 'NaN']]));
    else res.end(JSON.stringify(rows));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
