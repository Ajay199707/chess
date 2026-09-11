import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '/index.html') {
    let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replaceAll('/chess/', '/');
    res.writeHead(200, {'content-type':'text/html'}); res.end(html); return;
  }
  const file = path.join(root, urlPath.replace(/^\//, ''));
  if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
    res.writeHead(200, {'content-type': type}); res.end(fs.readFileSync(file)); return;
  }
  res.writeHead(404); res.end('Not found');
});
server.listen(4173, '0.0.0.0', () => console.log('Test server on 4173'));
