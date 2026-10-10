'use strict';
/**
 * serve.cjs — the tiny static server every export consumer shares.
 *
 * Extracted from export-films.cjs (Track T1.1): pages must run under a real
 * http origin — modules (the vendored MediaBunny) and fonts are origin-bound,
 * and file:// is opaque-origin and blocks import(). Root is the repo; paths
 * outside root are a 403; a missing file stays a 404.
 *
 * Mirror of Vite's public/ mapping: /vendor/... resolves to ROOT/public/...
 * while /docs/... resolves to ROOT/... — the same two locations one dev
 * server serves, or the vendored MediaBunny 404s and every export dies.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function serveRepo() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(String(req.url || '/').split('?')[0]);
        let file = path.normalize(path.join(ROOT, urlPath));
        if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
        if (!fs.existsSync(file)) {
          const pub = path.normalize(path.join(ROOT, 'public', urlPath));
          if (pub.startsWith(ROOT + path.sep) && fs.existsSync(pub)) file = pub;
        }
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        const data = fs.readFileSync(file);
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      } catch (e) { res.writeHead(404); res.end('not found'); }
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { serveRepo, MIME, ROOT };
