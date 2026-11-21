'use strict';

// Petit client HTTP pour les tests de l'espace d'administration.
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

function client(base) {
  const origin = base;
  // opts : { body, json, cookie, headers, ip, origin (false = aucun en-tête Origin) }
  async function call(method, p, opts = {}) {
    const headers = Object.assign({}, opts.headers);
    if (opts.origin !== false && (method === 'POST' || method === 'PUT')) headers.Origin = opts.origin || origin;
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.ip) headers['CF-Connecting-IP'] = opts.ip;
    let body = opts.body;
    if (opts.json !== undefined) { body = JSON.stringify(opts.json); headers['Content-Type'] = 'application/json'; }
    return fetch(base + p, { method, headers, body, redirect: 'manual' });
  }
  async function login(password, opts = {}) {
    const r = await call('POST', '/support/api/login', Object.assign({ json: { user: opts.user || 'support', password } }, opts));
    const sc = r.headers.getSetCookie().find((c) => c.startsWith('mccs_admin='));
    return { r, setCookie: sc, cookie: sc ? sc.split(';')[0] : undefined };
  }
  return { call, login, origin };
}

// Envoi brut (sans fetch) : pour lire une réponse anticipée (413) pendant l'envoi d'un gros corps.
function rawRequest(base, { method, path: p, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(base + p);
    const req = http.request({ host: u.hostname, port: u.port, method, path: u.pathname + u.search, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', (err) => (err.code === 'EPIPE' || err.code === 'ECONNRESET' ? undefined : reject(err)));
    req.end(body);
  });
}

// Serveur minimal autour de createAdmin, avec sa propre configuration (environnement au choix).
function startAdmin(env) {
  const { createSettings } = require('../../server/config');
  const { createAdmin } = require('../../server/admin');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-admin-'));
  const { config, settings } = createSettings({ env, dir });
  const admin = createAdmin({ config, settings, dataDir: dir });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (admin.handle(req, res, url)) return;
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    resolve({ server, base, dir, settings, config, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }) });
  }));
}

// Octets d'en-tête des formats acceptés.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x40, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(52, 3)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64, 4)]);

module.exports = { client, rawRequest, startAdmin, PNG, JPEG, WEBP, GIF };
