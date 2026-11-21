'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Environnement fixé avant de charger le serveur (lu au chargement de config.js).
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-admin-'));
process.env.DATA_DIR = DATA;
process.env.SUPPORT_PASSWORD = 'mot-de-passe-initial';
process.env.PUBLIC_URL = 'http://127.0.0.1';
delete process.env.SUPPORT_USER;
const { server } = require('../server/index');
const { client, rawRequest, startAdmin, PNG, JPEG, WEBP, GIF } = require('./helpers/admin-client');

const PASSWORD = 'mot-de-passe-initial';
const UPLOAD_RE = /^\/uploads\/(logo|background)-[0-9a-f]{16}\.(png|jpg|webp)$/;
let base, c, cookie;
let ipN = 0;
const freshIp = () => `198.51.100.${++ipN}`;

test.before(() => new Promise((resolve) => server.listen(0, '127.0.0.1', async () => {
  base = `http://127.0.0.1:${server.address().port}`;
  c = client(base);
  ({ cookie } = await c.login(PASSWORD));
  resolve();
})));
test.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));

/* ---------- Accès sans session ---------- */

test('sans session, /support et /support/index.html redirigent vers la page de connexion', async () => {
  for (const p of ['/support', '/support/', '/support/index.html']) {
    const r = await c.call('GET', p);
    assert.equal(r.status, 302, p);
    assert.equal(r.headers.get('location'), '/support/login.html', p);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});

test('sans session, la feuille de style du support reste servie, pas le script de l’admin', async () => {
  assert.equal((await c.call('GET', '/support/support.css')).status, 200);
  const r = await c.call('GET', '/support/support.js');
  assert.notEqual(r.status, 200);
});

test('sans session, /support/api/* répond 401 { error: "session" } en JSON non mis en cache', async () => {
  for (const [m, p] of [['GET', '/support/api/state'], ['PUT', '/support/api/settings'], ['POST', '/support/api/logout']]) {
    const r = await c.call(m, p, m === 'GET' ? {} : { json: {} });
    assert.equal(r.status, 401, p);
    assert.match(r.headers.get('content-type'), /^application\/json/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await r.json(), { error: 'session' });
  }
  const r = await c.call('GET', '/support/api/state', { cookie: 'mccs_admin=jeton-inventé' });
  assert.equal(r.status, 401);
});

test('avec une session, /support/ sert la page d’administration', async () => {
  const r = await c.call('GET', '/support/', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/html/);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('le site client ne pose jamais de cookie', async () => {
  for (const p of ['/', '/index.html', '/api/config', '/brand.css', '/healthz', '/nope']) {
    const r = await c.call('GET', p, { cookie });
    assert.deepEqual(r.headers.getSetCookie(), [], p);
  }
});

/* ---------- Connexion ---------- */

test('connexion refusée : 401 { error: "credentials" }, sans cookie', async () => {
  const ip = freshIp();
  let { r, setCookie } = await c.login('mauvais', { ip });
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), { error: 'credentials' });
  assert.equal(setCookie, undefined);
  ({ r } = await c.login(PASSWORD, { ip, user: 'autre' }));
  assert.equal(r.status, 401);
});

test('connexion acceptée : cookie HttpOnly, SameSite=Strict, Path=/support, 8 h, sans Secure en HTTP', async () => {
  const { r, setCookie } = await c.login(PASSWORD, { ip: freshIp() });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.match(setCookie, /^mccs_admin=[A-Za-z0-9_-]{43};/);
  const attrs = setCookie.split(';').slice(1).map((s) => s.trim());
  for (const a of ['HttpOnly', 'SameSite=Strict', 'Path=/support', 'Max-Age=28800']) assert.ok(attrs.includes(a), a);
  assert.ok(!attrs.includes('Secure'));
});

test('connexion derrière un proxy HTTPS : cookie Secure', async () => {
  const { setCookie } = await c.login(PASSWORD, { ip: freshIp(), headers: { 'X-Forwarded-Proto': 'https' } });
  assert.ok(setCookie.split(';').map((s) => s.trim()).includes('Secure'));
});

test('verrouillage : 10 échecs par IP, puis 429 au 11e essai même avec le bon mot de passe', async () => {
  const ip = freshIp();
  for (let i = 0; i < 10; i++) assert.equal((await c.login('mauvais', { ip })).r.status, 401, 'essai ' + (i + 1));
  const { r, setCookie } = await c.login(PASSWORD, { ip });
  assert.equal(r.status, 429);
  const body = await r.json();
  assert.equal(body.error, 'locked');
  assert.ok(Number.isInteger(body.retryAfter) && body.retryAfter > 0 && body.retryAfter <= 900, String(body.retryAfter));
  assert.equal(setCookie, undefined);
  // Une autre IP n'est pas concernée.
  assert.equal((await c.login(PASSWORD, { ip: freshIp() })).r.status, 200);
});

test('déconnexion : cookie effacé et session invalidée', async () => {
  const { cookie: mine } = await c.login(PASSWORD, { ip: freshIp() });
  const r = await c.call('POST', '/support/api/logout', { cookie: mine });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  const sc = r.headers.getSetCookie().find((x) => x.startsWith('mccs_admin='));
  assert.match(sc, /^mccs_admin=;/);
  assert.match(sc, /Max-Age=0/);
  assert.match(sc, /Path=\/support/);
  assert.equal((await c.call('GET', '/support/api/state', { cookie: mine })).status, 401);
});

/* ---------- Origine ---------- */

test('écritures sans Origin ou avec une origine étrangère : 403 { error: "origin" }', async () => {
  const cases = [
    ['POST', '/support/api/login', { json: { user: 'support', password: PASSWORD }, origin: false }],
    ['POST', '/support/api/login', { json: { user: 'support', password: PASSWORD }, origin: 'https://evil.example' }],
    ['PUT', '/support/api/settings', { json: { values: { BRAND_NAME: 'Pirate' } }, cookie, origin: false }],
    ['PUT', '/support/api/settings', { json: { values: { BRAND_NAME: 'Pirate' } }, cookie, origin: 'http://127.0.0.1.evil.example' }],
    ['POST', '/support/api/password', { json: { current: PASSWORD, next: 'nouveau-mot-de-passe' }, cookie, origin: 'null' }],
  ];
  for (const [m, p, o] of cases) {
    const r = await c.call(m, p, o);
    assert.equal(r.status, 403, `${m} ${p} ${o.origin}`);
    assert.deepEqual(await r.json(), { error: 'origin' });
    assert.deepEqual(r.headers.getSetCookie(), []);
  }
  const state = await (await c.call('GET', '/support/api/state', { cookie })).json();
  assert.notEqual(state.brand, 'Pirate');
});

/* ---------- État et réglages ---------- */

test('state : marque, écriture possible, assistant à faire, champs et provenance du mot de passe', async () => {
  const r = await c.call('GET', '/support/api/state', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const s = await r.json();
  assert.equal(s.brand, 'mccs');
  assert.equal(s.writable, true);
  assert.equal(s.setupDone, false);
  assert.equal(s.passwordFromEnv, true);
  assert.ok(Array.isArray(s.fields));
  const allowed = s.fields.find((f) => f.key === 'ALLOWED_DOMAINS');
  assert.equal(allowed.group, 'servers');
  assert.equal(allowed.type, 'domains');
});

test('PUT settings : enregistre et renvoie les champs ; 422 avec les erreurs par champ', async () => {
  let r = await c.call('PUT', '/support/api/settings', { cookie, json: { values: { BRAND_NAME: 'Acme Mail', ALLOWED_DOMAINS: 'acme.ch, Acme.fr' } } });
  assert.equal(r.status, 200);
  let body = await r.json();
  assert.equal(body.ok, true);
  const by = Object.fromEntries(body.fields.map((f) => [f.key, f]));
  assert.equal(by.BRAND_NAME.value, 'Acme Mail');
  assert.equal(by.BRAND_NAME.source, 'admin');
  assert.equal((await (await c.call('GET', '/api/config')).json()).brand, 'Acme Mail');

  r = await c.call('PUT', '/support/api/settings', { cookie, json: { values: { IMAP_PORT: '70000', BRAND_NAME: 'Autre' } } });
  assert.equal(r.status, 422);
  body = await r.json();
  assert.equal(body.ok, false);
  assert.equal(typeof body.errors.IMAP_PORT, 'string');
  assert.equal((await (await c.call('GET', '/support/api/state', { cookie })).json()).brand, 'Acme Mail');

  r = await c.call('PUT', '/support/api/settings', { cookie, json: { values: { ALLOWED_DOMAINS: 'acme.ch,pas un domaine' } } });
  assert.equal(r.status, 422);
});

test('PUT settings : JSON invalide 400, corps de plus de 64 Ko 413', async () => {
  let r = await c.call('PUT', '/support/api/settings', { cookie, body: '{pas du json', headers: { 'Content-Type': 'application/json' } });
  assert.equal(r.status, 400);
  r = await c.call('PUT', '/support/api/settings', { cookie, json: { values: { BRAND_NAME: 'x'.repeat(70 * 1024) } } });
  assert.equal(r.status, 413);
});

test('restauration : revient à la version précédente des réglages', async () => {
  await c.call('PUT', '/support/api/settings', { cookie, json: { values: { BRAND_NAME: 'Version A' } } });
  await c.call('PUT', '/support/api/settings', { cookie, json: { values: { BRAND_NAME: 'Version B' } } });
  const r = await c.call('POST', '/support/api/settings/restore', { cookie });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.fields.find((f) => f.key === 'BRAND_NAME').value, 'Version A');
});

test('restauration sans version précédente : 409 { ok: false }', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: PASSWORD, PUBLIC_URL: 'http://127.0.0.1' });
  try {
    const ac = client(a.base);
    const { cookie: k } = await ac.login(PASSWORD);
    const r = await ac.call('POST', '/support/api/settings/restore', { cookie: k });
    assert.equal(r.status, 409);
    assert.deepEqual(await r.json(), { ok: false });
  } finally { await a.close(); }
});

test('setup-done : écrit setupDone dans admin.json', async () => {
  const r = await c.call('POST', '/support/api/setup-done', { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal((await (await c.call('GET', '/support/api/state', { cookie })).json()).setupDone, true);
  const saved = JSON.parse(fs.readFileSync(path.join(DATA, 'admin.json'), 'utf8'));
  assert.equal(saved.version, 1);
  assert.equal(saved.setupDone, true);
});

/* ---------- Envois ---------- */

test('envoi : PNG, JPEG et WebP acceptés, puis servis depuis /uploads', async () => {
  assert.equal(fs.existsSync(path.join(DATA, 'uploads')), false, 'dossier créé à la demande seulement');
  for (const [type, bytes, kind, ext] of [['image/png', PNG, 'logo', 'png'], ['image/jpeg', JPEG, 'background', 'jpg'], ['image/webp', WEBP, 'background', 'webp']]) {
    const r = await c.call('POST', '/support/api/upload?kind=' + kind, { cookie, body: bytes, headers: { 'Content-Type': type } });
    assert.equal(r.status, 200, type);
    const body = await r.json();
    assert.equal(body.ok, true);
    assert.match(body.path, UPLOAD_RE);
    assert.ok(body.path.startsWith(`/uploads/${kind}-`) && body.path.endsWith('.' + ext));
    const g = await c.call('GET', body.path);
    assert.equal(g.status, 200);
    assert.equal(g.headers.get('content-type'), type);
    assert.equal(g.headers.get('x-content-type-options'), 'nosniff');
    assert.match(g.headers.get('cache-control'), /max-age=31536000/);
    assert.deepEqual(Buffer.from(await g.arrayBuffer()), bytes);
    assert.deepEqual(g.headers.getSetCookie(), []);
  }
});

test('envoi : faux PNG (GIF) 415, type refusé 415, type inconnu 400, plus de 2 Mo 413', async () => {
  let r = await c.call('POST', '/support/api/upload?kind=logo', { cookie, body: GIF, headers: { 'Content-Type': 'image/png' } });
  assert.equal(r.status, 415);
  r = await c.call('POST', '/support/api/upload?kind=logo', { cookie, body: GIF, headers: { 'Content-Type': 'image/gif' } });
  assert.equal(r.status, 415);
  r = await c.call('POST', '/support/api/upload?kind=logo', { cookie, body: '<svg/>', headers: { 'Content-Type': 'image/svg+xml' } });
  assert.equal(r.status, 415);
  r = await c.call('POST', '/support/api/upload?kind=favicon', { cookie, body: PNG, headers: { 'Content-Type': 'image/png' } });
  assert.equal(r.status, 400);

  const big = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]);
  const headers = { 'Content-Type': 'image/png', Origin: base, Cookie: cookie };
  let raw = await rawRequest(base, { method: 'POST', path: '/support/api/upload?kind=logo', headers, body: big });
  assert.equal(raw.status, 413);
  // Sans Content-Length (envoi par morceaux) : coupé au dépassement.
  raw = await rawRequest(base, { method: 'POST', path: '/support/api/upload?kind=logo', headers: Object.assign({ 'Transfer-Encoding': 'chunked' }, headers), body: big });
  assert.equal(raw.status, 413);
});

test('envoi sans session : 401', async () => {
  const r = await c.call('POST', '/support/api/upload?kind=logo', { body: PNG, headers: { 'Content-Type': 'image/png' } });
  assert.equal(r.status, 401);
});

test('/uploads : seuls les noms générés sont servis (pas de traversée)', async () => {
  for (const p of ['/uploads/config.json', '/uploads/../admin.json', '/uploads/%2e%2e/admin.json', '/uploads/..%2fadmin.json',
    '/uploads/logo-0123456789abcdef.svg', '/uploads/logo-0123456789ABCDEF.png', '/uploads/logo-0123456789abcdef.png', '/uploads/']) {
    const r = await c.call('GET', p);
    assert.equal(r.status, 404, p);
  }
  assert.equal((await c.call('POST', '/uploads/logo-0123456789abcdef.png', { body: PNG })).status, 405);
});

/* ---------- Test des serveurs ---------- */

test('probe : hôte ou port invalides refusés, port fermé « unreachable »', async () => {
  let r = await c.call('POST', '/support/api/probe', { cookie, json: { host: 'pas un hôte', port: 993, security: 'SSL/TLS' } });
  assert.equal(r.status, 422);
  r = await c.call('POST', '/support/api/probe', { cookie, json: { host: 'mail.example.com', port: 0, security: 'SSL/TLS' } });
  assert.equal(r.status, 422);
  r = await c.call('POST', '/support/api/probe', { cookie, json: { host: 'mail.example.com', port: 993, security: 'NONE' } });
  assert.equal(r.status, 422);
  const net = require('node:net');
  const s = net.createServer();
  await new Promise((res) => s.listen(0, '127.0.0.1', res));
  const { port } = s.address();
  await new Promise((res) => s.close(res));
  r = await c.call('POST', '/support/api/probe', { cookie, json: { host: '127.0.0.1', port, security: 'SSL/TLS' } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'unreachable');
});

/* ---------- Mot de passe ---------- */

test('mot de passe : 401 si l’actuel est faux, 422 si le nouveau est trop court', async () => {
  let r = await c.call('POST', '/support/api/password', { cookie, json: { current: 'faux', next: 'nouveau-mot-de-passe' } });
  assert.equal(r.status, 401);
  r = await c.call('POST', '/support/api/password', { cookie, json: { current: PASSWORD, next: 'court' } });
  assert.equal(r.status, 422);
  // Rien n'a changé : l'initial fonctionne toujours.
  assert.equal((await c.login(PASSWORD, { ip: freshIp() })).r.status, 200);
});

test('mot de passe changé : l’ancien est refusé, admin.json ne contient qu’un haché ; supprimer admin.json réactive SUPPORT_PASSWORD', async () => {
  const NEXT = 'un-nouveau-mot-de-passe-solide';
  let r = await c.call('POST', '/support/api/password', { cookie, json: { current: PASSWORD, next: NEXT } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  // La session qui a changé le mot de passe reste valide.
  const state = await (await c.call('GET', '/support/api/state', { cookie })).json();
  assert.equal(state.passwordFromEnv, false);
  assert.equal(state.setupDone, true, 'setupDone conservé');

  const file = path.join(DATA, 'admin.json');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(!text.includes(NEXT) && !text.includes(PASSWORD));
  const saved = JSON.parse(text);
  assert.equal(saved.version, 1);
  assert.equal(typeof saved.password.salt, 'string');
  assert.equal(typeof saved.password.hash, 'string');
  assert.equal((fs.statSync(file).mode & 0o077), 0, 'fichier lisible par le seul propriétaire');

  assert.equal((await c.login(PASSWORD, { ip: freshIp() })).r.status, 401);
  assert.equal((await c.login(NEXT, { ip: freshIp() })).r.status, 200);

  fs.unlinkSync(file);
  assert.equal((await c.login(NEXT, { ip: freshIp() })).r.status, 401);
  assert.equal((await c.login(PASSWORD, { ip: freshIp() })).r.status, 200);
});

/* ---------- Désactivation et méthodes ---------- */

test('sans SUPPORT_PASSWORD ni haché, /support répond 404', async () => {
  const a = await startAdmin({});
  try {
    const ac = client(a.base);
    for (const p of ['/support', '/support/', '/support/login.html', '/support/api/state']) {
      assert.equal((await ac.call('GET', p)).status, 404, p);
    }
    assert.equal((await ac.login('')).r.status, 404);
  } finally { await a.close(); }
});

test('méthodes : POST et PUT réservés à /support/api/*', async () => {
  assert.equal((await c.call('POST', '/', { body: 'x' })).status, 405);
  assert.equal((await c.call('PUT', '/api/config', { body: 'x' })).status, 405);
  assert.equal((await c.call('POST', '/support/', { cookie, body: 'x' })).status, 405);
  assert.equal((await c.call('DELETE', '/support/api/state', { cookie })).status, 405);
  assert.equal((await c.call('GET', '/support/api/login')).status, 405);
  const r = await c.call('GET', '/support/api/inconnu', { cookie });
  assert.equal(r.status, 404);
  assert.match(r.headers.get('content-type'), /^application\/json/);
});
