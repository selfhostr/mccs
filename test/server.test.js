'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Dossier de réglages temporaire, avant de charger le serveur (lu au chargement de config.js).
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-server-'));
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

test('le HTML référence /brand.css sans numéro de version', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /href="\/brand\.css"/);
});
