const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Extract target URL from request
  const targetUrl = req.url.slice(1); // remove leading /
  if (!targetUrl.startsWith('https://')) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const authHeader = req.headers['authorization'];

  const options = {
    method: 'GET',
    headers: authHeader ? { 'Authorization': authHeader } : {}
  };

  https.get(targetUrl, options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  }).on('error', (e) => {
    res.writeHead(500);
    res.end('Proxy error: ' + e.message);
  });
});

server.listen(PORT, () => {
  console.log('✓ Прокси сервер запущен!');
  console.log('✓ Адрес: http://localhost:' + PORT);
});
