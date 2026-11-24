'use strict';

// Référencement servi par le serveur principal : head de /, robots.txt, sitemap.xml, X-Robots-Tag de /support.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-seo-server-'));
process.env.SUPPORT_PASSWORD = 'test-password';
delete process.env.PUBLIC_URL;
const { server, settings } = require('../server/index');

let base;
test.before(() => new Promise((resolve) => server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); })));
test.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));

test('/ : head rendu par le serveur, régénéré à l’enregistrement des réglages', async () => {
  let html = await (await fetch(base + '/')).text();
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<title>Configurer ma messagerie · mccs<\/title>/);
  assert.deepEqual(settings.save({ SEO_TITLE: 'Aide <messagerie> Acme', SEO_INDEX: 'true' }), { ok: true });
  html = await (await fetch(base + '/', { headers: { 'Accept-Encoding': 'gzip' } })).text();
  assert.match(html, /<title>Aide &lt;messagerie&gt; Acme<\/title>/);
  assert.match(html, /<meta name="robots" content="index, follow">/);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  // /index.html sert la même page.
  assert.match(await (await fetch(base + '/index.html')).text(), /<title>Aide &lt;messagerie&gt; Acme<\/title>/);
  settings.save({ SEO_TITLE: '', SEO_INDEX: '' });
});

test('/robots.txt et /sitemap.xml suivent SEO_INDEX et PUBLIC_URL', async () => {
  let r = await fetch(base + '/robots.txt');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/plain/);
  assert.equal(await r.text(), 'User-agent: *\nDisallow: /\n');
  assert.equal((await fetch(base + '/sitemap.xml')).status, 404);

  settings.save({ SEO_INDEX: 'true' });
  assert.equal(await (await fetch(base + '/robots.txt')).text(), 'User-agent: *\nAllow: /\nDisallow: /support\n');
  assert.equal((await fetch(base + '/sitemap.xml')).status, 404, 'pas de sitemap sans adresse publique');

  settings.save({ PUBLIC_URL: 'https://config.acme.example' });
  assert.match(await (await fetch(base + '/robots.txt')).text(), /Sitemap: https:\/\/config\.acme\.example\/sitemap\.xml\n$/);
  r = await fetch(base + '/sitemap.xml');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^application\/xml/);
  assert.match(await r.text(), /<loc>https:\/\/config\.acme\.example\/<\/loc>/);
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<link rel="canonical" href="https:\/\/config\.acme\.example\/">/);

  settings.save({ SEO_INDEX: 'false' });
  assert.equal((await fetch(base + '/sitemap.xml')).status, 404);
  settings.save({ SEO_INDEX: '', PUBLIC_URL: '' });
});

test('/support reste noindex même quand l’indexation est autorisée', async () => {
  settings.save({ SEO_INDEX: 'true' });
  for (const p of ['/support', '/support/', '/support/login.html', '/support/support.css', '/support/admin.js', '/support/api/state']) {
    const r = await fetch(base + p, { redirect: 'manual' });
    assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow', p);
  }
  settings.save({ SEO_INDEX: '' });
});

test('le bloc JSON-LD n’est pas bloqué par la CSP (données, pas un script exécuté)', async () => {
  const r = await fetch(base + '/');
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(await r.text(), /<script type="application\/ld\+json">\{/);
});
