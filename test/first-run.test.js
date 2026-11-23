'use strict';

// Premier démarrage sans aucune configuration : mot de passe admin généré et affiché dans les logs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { client, startAdmin } = require('./helpers/admin-client');
const os = require('node:os');
const { createSettings } = require('../server/config');

test('sans SUPPORT_PASSWORD, le premier démarrage crée un mot de passe qui ouvre /support', async () => {
  const a = await startAdmin({});
  try {
    const first = a.admin.firstRun();
    assert.ok(first && typeof first.password === 'string' && first.password.length >= 20, JSON.stringify(first));
    assert.ok(fs.existsSync(path.join(a.dir, 'admin.json')));
    const { r } = await client(a.base).login(first.password);
    assert.equal(r.status, 200);
    const { cookie } = await client(a.base).login(first.password);
    const st = await (await client(a.base).call('GET', '/support/api/state', { cookie })).json();
    assert.equal(st.passwordFromEnv, true, 'l’admin est invité à choisir son mot de passe');
    // Redémarrage : le même mot de passe est rappelé tant qu'il n'a pas été changé.
    assert.equal(a.admin.firstRun().password, first.password);
  } finally { await a.close(); }
});

test('une fois le mot de passe changé, il n’est plus rappelé ni gardé en clair', async () => {
  const a = await startAdmin({});
  try {
    const { password } = a.admin.firstRun();
    const c = client(a.base);
    const { cookie } = await c.login(password);
    const r = await c.call('POST', '/support/api/password', { cookie, json: { current: password, next: 'un-nouveau-mot-de-passe' } });
    assert.equal(r.status, 200);
    assert.equal(a.admin.firstRun(), null);
    const left = fs.readdirSync(a.dir).filter((f) => f.includes('password'));
    assert.deepEqual(left, []);
  } finally { await a.close(); }
});

test('avec SUPPORT_PASSWORD, rien n’est généré', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: 'mot-de-passe-initial' });
  try {
    assert.equal(a.admin.firstRun(), null);
    assert.ok(!fs.existsSync(path.join(a.dir, 'admin.json')));
  } finally { await a.close(); }
});

test('sans PUBLIC_URL, l’adresse publique est celle du navigateur (vide côté serveur)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-pub-'));
  assert.equal(createSettings({ env: {}, dir }).config.publicUrl, '');
});
