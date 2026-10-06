// Serve a previously exported mobile web build for local review.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../artifacts/mobile/web-build');
const port = Number(process.argv[2] || 8087);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Export the mobile web build first.');
http.createServer((req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + requested);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(requested)) { res.writeHead(404); res.end(); return; }
      file = path.join(root, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end(); }
}).listen(port, '127.0.0.1', () => console.log('Mongle preview: http://localhost:' + port + '/(tabs)'));
