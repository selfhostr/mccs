'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Dossier de réglages temporaire, avant de charger le serveur (lu au chargement de config.js).
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-server-'));
process.env.SUPPORT_PASSWORD = 'test-password';
const { server, settings } = require('../server/index');

let base;
test.before(() => new Promise((resolve) => server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); })));
test.after(() => new Promise((resolve) => server.close(resolve)));

test('/brand.css reflète le fond de page enregistré, sans cache durable', async () => {
  assert.deepEqual(settings.save({ BRAND_BACKGROUND: '#112233' }), { ok: true });
  let r = await fetch(base + '/brand.css');
  assert.equal(r.headers.get('cache-control'), 'no-cache');
  assert.match(await r.text(), /--brand-bg: #112233;/);

  settings.save({ BRAND_BACKGROUND: '#112233,#445566' });
  r = await fetch(base + '/brand.css');
  assert.match(await r.text(), /linear-gradient\(160deg, #112233, #445566\)/);

  settings.save({ BRAND_BACKGROUND: '/uploads/fond.webp' });
  r = await fetch(base + '/brand.css');
  assert.match(await r.text(), /url\("\/uploads\/fond\.webp"\)/);
});

test('/api/config suit les réglages sans redémarrage', async () => {
  settings.save({ BRAND_NAME: 'Acme Mail' });
  const cfg = await (await fetch(base + '/api/config')).json();
  assert.equal(cfg.brand, 'Acme Mail');
});

test('la CSP autorise l’origine d’un logo externe enregistré', async () => {
  settings.save({ BRAND_LOGO_URL: 'https://cdn.acme.ch/logo.svg' });
  const r = await fetch(base + '/');
  assert.match(r.headers.get('content-security-policy'), /img-src 'self' data: https:\/\/cdn\.acme\.ch;/);
});

// Un proxy ou un CDN peut garder /brand.css malgré no-cache : l'URL change avec son contenu.
test('le HTML référence /brand.css avec une version qui suit les réglages', async () => {
  const ref = async (u) => (await (await fetch(base + u)).text()).match(/href="(\/brand\.css\?v=[0-9a-f]+)"/);
  settings.save({ BRAND_ACCENT: '#123456' });
  const before = await ref('/');
  assert.ok(before, 'lien versionné dans /');
  for (const u of ['/404.html', '/support/login.html']) assert.equal((await ref(u))[1], before[1], u);
  settings.save({ BRAND_ACCENT: '#654321' });
  const after = await ref('/');
  assert.notEqual(after[1], before[1]);
  assert.equal((await ref('/support/login.html'))[1], after[1]);
  assert.match(await (await fetch(base + after[1])).text(), /--accent: #654321;/);
});

test('un nom avec apostrophe typographique ne fait pas planter /support', async () => {
  settings.save({ BRAND_NAME: 'L’Atelier' });
  const r = await fetch(base + '/support/', { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/support/login.html');
});

test('POST /api/test : 404 tant que l’option est désactivée, puis servi par le serveur principal', async () => {
  const cfg = await (await fetch(base + '/api/config')).json();
  assert.equal(cfg.connectionTest, false);
  let r = await fetch(base + '/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: '{}' });
  assert.equal(r.status, 404);
  settings.save({ CONNECTION_TEST: 'true' });
  assert.equal((await (await fetch(base + '/api/config')).json()).connectionTest, true);
  r = await fetch(base + '/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'x', password: 'y' }) });
  assert.equal(r.status, 422);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  settings.save({ CONNECTION_TEST: '' });
});

test('les autres routes refusent toujours POST', async () => {
  const r = await fetch(base + '/api/config', { method: 'POST', headers: { Origin: base } });
  assert.equal(r.status, 405);
});
