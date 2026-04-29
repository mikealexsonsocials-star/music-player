const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.YANDEX_TOKEN;

function proxyYandex(targetUrl, res) {
  const parsed = url.parse(targetUrl);
  const options = {
    hostname: parsed.hostname,
    path: parsed.path,
    method: 'GET',
    headers: {
      'Authorization': `OAuth ${TOKEN}`,
      'Accept': 'application/json'
    }
  };
  const req = https.request(options, apiRes => {
    res.writeHead(apiRes.statusCode, {
      'Content-Type': apiRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    apiRes.pipe(res);
  });
  req.on('error', err => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  });
  req.end();
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    res.end();
    return;
  }

  // Health check
  if (pathname === '/' || pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // PWA manifest
  if (pathname === '/manifest.json') {
    const file = path.join(__dirname, 'manifest.json');
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'application/manifest+json', 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }

  // Service worker
  if (pathname === '/sw.js') {
    const file = path.join(__dirname, 'sw.js');
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/', 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }

  // Icons (PNG fallback — просто возвращаем SVG как PNG)
  if (pathname === '/icon-192.png' || pathname === '/icon-512.png') {
    const size = pathname.includes('512') ? 512 : 192;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${size*0.22}" fill="#0a0a0f"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size*0.39}" fill="#ffffff08" stroke="#ffffff22" stroke-width="2"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size*0.078}" fill="#64d2ff" opacity="0.9"/>
      <path d="M${size/2-8} ${size/2-6} L${size/2+10} ${size/2} L${size/2-8} ${size/2+6} Z" fill="#0a0a0f"/>
    </svg>`;
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*' });
    res.end(svg);
    return;
  }

  // Yandex Disk proxy
  if (pathname === '/proxy') {
    if (!TOKEN) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'YANDEX_TOKEN not set' }));
      return;
    }
    const targetPath = parsed.query.path || '/music';
    const limit = parsed.query.limit || 1000;
    const offset = parsed.query.offset || 0;
    const targetUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(targetPath)}&limit=${limit}&offset=${offset}&fields=_embedded.items.name,_embedded.items.type,_embedded.items.path,_embedded.items.file,_embedded.items.mime_type,_embedded.offset,_embedded.total`;
    proxyYandex(targetUrl, res);
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Self-ping to prevent Render sleep
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    setInterval(() => {
      https.get(`${selfUrl}/ping`, r => console.log(`[ping] ${r.statusCode}`))
        .on('error', e => console.warn('[ping] error:', e.message));
    }, 14 * 60 * 1000);
  }
});
