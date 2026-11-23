'use strict';

// Serveur minimal autour de createConnectionTest (POST /api/test), avec sa propre configuration.
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

// extra : options supplémentaires de createConnectionTest (ca, timeoutMs, test, maxConcurrent).
function startConnectionTest(env, extra = {}) {
  const { createSettings } = require('../../server/config');
  const { createConnectionTest } = require('../../server/connection-test');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-test-'));
  const { config, settings } = createSettings({ env, dir });
  const ct = createConnectionTest(Object.assign({ config }, extra));
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (ct.handle(req, res, url)) return;
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    // post(body, { origin, ip, headers, raw }) : envoie { email, password } en JSON.
    const post = (body, opts = {}) => {
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers);
      if (opts.origin !== false) headers.Origin = opts.origin || base;
      if (opts.ip) headers['CF-Connecting-IP'] = opts.ip;
      return fetch(base + '/api/test', { method: 'POST', headers, body: opts.raw !== undefined ? opts.raw : JSON.stringify(body) });
    };
    resolve({ server, base, config, settings, post, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }) });
  }));
}

// Envoie l'en-tête et le début de n corps, puis termine toutes les requêtes en même temps.
function simultaneous(base, bodies, headersFor = () => ({})) {
  const u = new URL(base);
  const reqs = [];
  const done = bodies.map((b, i) => new Promise((resolve) => {
    const body = JSON.stringify(b);
    const req = http.request({
      host: u.hostname, port: u.port, method: 'POST', path: '/api/test',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Origin: base }, headersFor(i)),
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', () => resolve(0));
    req.write(body.slice(0, 5));
    reqs.push(() => req.end(body.slice(5)));
  }));
  return new Promise((r) => setTimeout(r, 300)).then(() => { reqs.forEach((end) => end()); return Promise.all(done); });
}

module.exports = { startConnectionTest, simultaneous };
