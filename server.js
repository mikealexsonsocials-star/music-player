const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check / wake-up ping
  if (req.url === '/' || req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // Extract target URL — strip leading slash
  const targetUrl = req.url.slice(1);

  if (!targetUrl.startsWith('https://')) {
    res.writeHead(400);
    res.end('Bad Request: URL must start with https://');
    return;
  }

  const authHeader = req.headers['authorization'];
  const parsed = url.parse(targetUrl);

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.path,
    method: 'GET',
    headers: {
      ...(authHeader ? { 'Authorization': authHeader } : {}),
      'User-Agent': 'Mozilla/5.0',
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end('Proxy error: ' + e.message);
    }
  });

  proxyReq.end();
});

server.listen(PORT, () => {
  console.log('✓ Прокси сервер запущен на порту ' + PORT);
});

// Self-ping every 14 minutes to prevent Render spin-down
// (Render free tier sleeps after 15 min of inactivity)
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(() => {
  const pingUrl = url.parse(SELF_URL + '/ping');
  const mod = SELF_URL.startsWith('https') ? https : http;
  mod.get({ hostname: pingUrl.hostname, path: '/ping', port: pingUrl.port || (SELF_URL.startsWith('https') ? 443 : 80) }, (r) => {
    console.log('Self-ping:', r.statusCode);
  }).on('error', () => {});
}, 14 * 60 * 1000);
