'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../server/store');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-store-'));

test('write puis read renvoie les mêmes valeurs', () => {
  const s = createStore(tmp());
  assert.equal(s.writable, true);
  s.write({ BRAND_NAME: 'Acme' });
  assert.deepEqual(s.read(), { BRAND_NAME: 'Acme' });
});

test('un fichier absent donne un objet vide', () => {
  assert.deepEqual(createStore(tmp()).read(), {});
});

test('la version précédente est gardée et restaurable', () => {
  const dir = tmp();
  const s = createStore(dir);
  s.write({ BRAND_NAME: 'Un' });
  s.write({ BRAND_NAME: 'Deux' });
  assert.ok(fs.existsSync(path.join(dir, 'config.prev.json')));
  assert.equal(s.restorePrevious(), true);
  assert.deepEqual(s.read(), { BRAND_NAME: 'Un' });
});

test('restorePrevious sans version précédente renvoie false', () => {
  assert.equal(createStore(tmp()).restorePrevious(), false);
});

test('un fichier corrompu ou d’une version inconnue est ignoré', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), '{bad');
  assert.deepEqual(createStore(dir).read(), {});
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ version: 99, values: { BRAND_NAME: 'x' } }));
  assert.deepEqual(createStore(dir).read(), {});
});

test('l’écriture est atomique (aucun fichier temporaire ne reste)', () => {
  const dir = tmp();
  createStore(dir).write({ BRAND_NAME: 'Acme' });
  assert.deepEqual(fs.readdirSync(dir).sort(), ['config.json']);
});

test('un dossier en lecture seule rend le stockage non modifiable', { skip: process.getuid && process.getuid() === 0 }, () => {
  const dir = tmp();
  fs.chmodSync(dir, 0o500);
  const s = createStore(dir);
  assert.equal(s.writable, false);
  assert.throws(() => s.write({ BRAND_NAME: 'x' }));
  fs.chmodSync(dir, 0o700);
});

test('un dossier absent rend le stockage non modifiable', () => {
  const s = createStore(path.join(tmp(), 'absent'));
  assert.equal(s.writable, false);
  assert.deepEqual(s.read(), {});
});
