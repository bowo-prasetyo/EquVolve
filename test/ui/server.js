// A minimal static file server for the browser tests. Web Workers
// cannot load from file:// pages, so the app has to be served over HTTP.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

// Resolves with { url, close } once the server listens on a free port.
function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end();
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }

      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

module.exports = { startServer };
