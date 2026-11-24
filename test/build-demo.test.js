'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-demo-test-'));
const { parseArgs, rewriteHtml, rewriteJs, leftovers, bundleServer, build } = require('../tools/build-demo');

test('les chemins absolus du HTML passent sous le préfixe, pas les ancres ni les URL externes', () => {
  const html = '<link href="/css/app.css"><script src="/js/app.js"></script><a href="/">x</a><a href="#/appareil"></a><a href="https://example.com/">e</a><a href="//cdn.example.com/x">c</a>';
  assert.equal(rewriteHtml(html, '/demo/'),
    '<link href="/demo/css/app.css"><script src="/demo/js/app.js"></script><a href="/demo/">x</a><a href="#/appareil"></a><a href="https://example.com/">e</a><a href="//cdn.example.com/x">c</a>');
});

test('les chemins de l’application dans le JS passent sous le préfixe, pas les valeurs de réglage', () => {
  const js = [
    "import { h } from '/support/fields.js';",
    "fetch('/api/config');",
    "location.href = '/support/login.html?expire=1';",
    "document.querySelector('link[href^=\"/brand.css\"]');",
    "return '/profile.mobileconfig?' + p;",
    "h('a', { href: '/', text: 'Voir' });",
    "if (v.startsWith('/uploads/')) x();",
    "const t = '/webdav/calendar';",
    "location.hash = '/guide/';",
  ].join('\n');
  const out = rewriteJs(js, '/demo/');
  assert.match(out, /from '\/demo\/support\/fields\.js'/);
  assert.match(out, /fetch\('\/demo\/api\/config'\)/);
  assert.match(out, /'\/demo\/support\/login\.html\?expire=1'/);
  assert.match(out, /href\^="\/demo\/brand\.css"/);
  assert.match(out, /'\/demo\/profile\.mobileconfig\?'/);
  assert.match(out, /href: '\/demo\/'/);
  assert.match(out, /startsWith\('\/uploads\/'\)/);
  assert.match(out, /'\/webdav\/calendar'/);
  assert.match(out, /'\/guide\/'/);
  assert.deepEqual(leftovers(out, '/demo/'), []);
  assert.equal(leftovers(js, '/demo/').length, 6);
});

test('options : préfixe entre deux « / », URL sans « / » final', () => {
  const o = parseArgs(['--base', '/essai/', '--public-url', 'https://x.example.com/essai/', '--out', 'tmp/d']);
  assert.equal(o.base, '/essai/');
  assert.equal(o.publicUrl, 'https://x.example.com/essai');
  assert.ok(path.isAbsolute(o.out));
  assert.throws(() => parseArgs(['--base', 'demo']));
  assert.throws(() => parseArgs(['--nope', 'x']));
});

test('le build écrit une démo complète, sans chemin absolu oublié', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-demo-out-'));
  try {
    build({ out, base: '/demo/', publicUrl: 'https://demo.example.com/demo', site: 'https://mccs.example.com' });
    const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    assert.match(index, /<script src="\/demo\/demo-layer\/demo\.js"><\/script>/);
    assert.match(index, /<link rel="stylesheet" href="\/demo\/demo-layer\/demo\.css">/);
    // <head> de référencement rendu par server/seo.js pour la marque fictive, non indexé.
    assert.match(index, /<title>Configurer ma messagerie · Acme Mail<\/title>/);
    assert.match(index, /<meta name="robots" content="noindex, nofollow">/);
    for (const f of ['support/index.html', 'support/login.html', 'js/app.js', 'support/admin.js', 'brand.css', 'fonts/inter-latin-wght-normal.woff2']) {
      assert.ok(fs.existsSync(path.join(out, f)), f);
    }
    assert.ok(!fs.existsSync(path.join(out, 'img/guides/README.md')));
    const cfg = JSON.parse(fs.readFileSync(path.join(out, 'api', 'config'), 'utf8'));
    assert.equal(cfg.brand, 'Acme Mail');
    assert.equal(cfg.publicUrl, 'https://demo.example.com/demo');
    assert.equal(cfg.imap.host, 'mail.example.com');
    assert.deepEqual(cfg.shots, []);
    assert.equal(fs.readFileSync(path.join(out, 'brand.css'), 'utf8'), ':root {  }\n');
    // La couche démo est un script valide.
    new vm.Script(fs.readFileSync(path.join(out, 'demo-layer', 'demo.js'), 'utf8'));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('les modules de server/ embarqués valident et enregistrent comme le serveur', () => {
  const files = new Map();
  const enoent = (p) => Object.assign(new Error('ENOENT ' + p), { code: 'ENOENT' });
  const fakeFs = {
    constants: { W_OK: 2 },
    accessSync() {},
    statSync: (p) => ({ isDirectory: () => p === '/data', isFile: () => p !== '/data' }),
    existsSync: (p) => p === '/data' || files.has(p),
    readFileSync(p) { if (!files.has(p)) throw enoent(p); return files.get(p); },
    writeFileSync: (p, d) => files.set(p, String(d)),
    renameSync(a, b) { files.set(b, files.get(a)); files.delete(a); },
    unlinkSync: (p) => files.delete(p),
    copyFileSync: (a, b) => files.set(b, files.get(a)),
  };
  // Même domaine JavaScript que le test (settings.save refuse un objet d'un autre domaine, comme le serveur).
  const mccsServer = new Function(bundleServer() + ';return mccsServer;')();
  const req = mccsServer({ fs: fakeFs, path: { join: (...p) => p.join('/') }, crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' } }, { env: { DATA_DIR: '/data' }, pid: 1 });
  const { settings, config } = req('./config');
  assert.equal(settings.writable, true);
  assert.equal(settings.save({ BRAND_ACCENT: 'rouge' }).ok, false);
  assert.deepEqual(settings.save({ BRAND_NAME: 'Exemple', BRAND_ACCENT: '#123456' }), { ok: true });
  assert.equal(config.brand, 'Exemple');
  assert.match(files.get('/data/config.json'), /"BRAND_NAME": "Exemple"/);
  assert.equal(req('./brand').brandCss(config), ':root { --accent: #123456; --accent-on: #ffffff; }\n');
  const profile = req('./mobileconfig').buildProfile({ email: 'a@example.com', name: '', services: ['mail'], config });
  assert.match(profile, /<string>mail\.example\.com<\/string>/);
});
