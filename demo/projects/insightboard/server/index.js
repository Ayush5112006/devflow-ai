import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { predictionsRouter } from './routes/predictions.js';
import { ordersRouter } from './routes/orders.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(here, '..', 'web');
const PORT = Number(process.env.PORT ?? 3000);

const routers = [predictionsRouter, ordersRouter];

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const target = path.join(webRoot, rel);
  if (!target.startsWith(webRoot)) { sendJson(res, 403, { error: 'forbidden' }); return; }
  if (!fs.existsSync(target)) { sendJson(res, 404, { error: 'not_found', path: pathname }); return; }
  const type = target.endsWith('.html') ? 'text/html; charset=utf-8'
    : target.endsWith('.js') ? 'text/javascript; charset=utf-8'
    : target.endsWith('.css') ? 'text/css; charset=utf-8'
    : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(fs.readFileSync(target));
}

export const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const started = Date.now();

  for (const router of routers) {
    const hit = router.match(req.method, url.pathname);
    if (!hit) continue;
    try {
      hit.handler({ params: hit.params, query: Object.fromEntries(url.searchParams) }, {
        json: sendJson,
        status: (code) => ({ json: (c, b) => sendJson(res, c, b) }),
      });
    } catch (err) {
      console.error(`[insightboard] ${req.method} ${url.pathname} failed: ${err.message}`);
      console.error(err.stack);
      sendJson(res, 500, { error: 'internal_error', message: err.message });
    }
    console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    console.log(`${req.method} ${url.pathname} 404 ${Date.now() - started}ms`);
    sendJson(res, 404, { error: 'not_found', path: url.pathname });
    return;
  }
  serveStatic(res, url.pathname);
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[insightboard] listening on http://localhost:${PORT}`);
  });
}
