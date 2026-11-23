'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { client, startAdmin } = require('./helpers/admin-client');

const PASSWORD = 'mot-de-passe-initial';
let srv, c, cookie;
const calls = [];
const FOUND = {
  caldav: { url: 'https://dav.example.com/dav/', via: 'dns' },
  carddav: null,
  server: 'generic',
  details: ['DNS : _caldavs._tcp.example.com désigne https://dav.example.com/.well-known/caldav'],
};

test.before(async () => {
  srv = await startAdmin({ SUPPORT_PASSWORD: PASSWORD, PUBLIC_URL: 'http://127.0.0.1' }, {
    discover: async (opts) => { calls.push(opts); return FOUND; },
  });
  c = client(srv.base);
  ({ cookie } = await c.login(PASSWORD));
});
test.after(() => srv.close());

test('discover : 200 { ok, caldav, carddav, server, details }', async () => {
  const r = await c.call('POST', '/support/api/discover', { cookie, json: { host: 'mail.example.com' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await r.json(), Object.assign({ ok: true }, FOUND));
  assert.equal(calls.at(-1).host, 'mail.example.com');
  assert.equal(calls.at(-1).port, 443);
});

test('discover : une URL https:// est acceptée (hôte et port)', async () => {
  const r = await c.call('POST', '/support/api/discover', { cookie, json: { host: 'https://cloud.example.com:8443/remote.php/dav' } });
  assert.equal(r.status, 200);
  assert.equal(calls.at(-1).host, 'cloud.example.com');
  assert.equal(calls.at(-1).port, 8443);
});

test('discover : hôte invalide ou absent -> 422 { error: "invalid", errors.host }', async () => {
  for (const host of ['', 'pas un hôte', 'ftp://x.example.com', 42, 'https://', 'localhost']) {
    const n = calls.length;
    const r = await c.call('POST', '/support/api/discover', { cookie, json: { host } });
    assert.equal(r.status, 422, String(host));
    const b = await r.json();
    assert.equal(b.ok, false);
    assert.equal(b.error, 'invalid');
    assert.equal(typeof b.errors.host, 'string');
    assert.equal(calls.length, n, 'discover ne doit pas être appelé');
  }
});

test('discover : Origin étrangère refusée (403), session exigée (401), GET refusé (405)', async () => {
  let r = await c.call('POST', '/support/api/discover', { cookie, json: { host: 'mail.example.com' }, origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  r = await c.call('POST', '/support/api/discover', { json: { host: 'mail.example.com' } });
  assert.equal(r.status, 401);
  r = await c.call('GET', '/support/api/discover', { cookie });
  assert.equal(r.status, 405);
});
