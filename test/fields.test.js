'use strict';

// public/support/fields.js (module du navigateur) : valeurs déduites et validation, testées sous Node.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Chargé comme module ES depuis son texte (le dépôt n'a pas de "type": "module" ; aucun import dans ce fichier).
const SRC = fs.readFileSync(path.join(__dirname, '../public/support/fields.js'), 'utf8');
const load = () => import('data:text/javascript;charset=utf-8,' + encodeURIComponent(SRC));
// entries au format de admin.js : clé -> { field, value }.
const entries = (values) => new Map(Object.entries(values).map(([k, v]) => [k, { field: { key: k, source: 'default' }, value: v }]));

test('resolver : sans préréglage, gabarits MDaemon (comme server/config.js)', async () => {
  const { resolver } = await load();
  const { resolve } = resolver(entries({ MAIL_HOST: 'mail.a.example' }));
  assert.equal(resolve('DAV_PRESET'), 'mdaemon');
  assert.equal(resolve('DAV_CALENDAR_URL_TEMPLATE'), 'https://mail.a.example/webdav/caldav/{domain}/{local}/b64=Q2FsZW5kYXI/');
  assert.equal(resolve('DAV_DISCOVERY_URL'), 'https://mail.a.example/.well-known/caldav');
});

test('resolver : generic suit les URL découvertes', async () => {
  const { resolver } = await load();
  const { resolve } = resolver(entries({
    MAIL_HOST: 'mail.a.example', DAV_PRESET: 'generic',
    DAV_DISCOVERY_URL: 'https://dav.a.example/cal/', DAV_CARD_DISCOVERY_URL: 'https://dav.a.example/card/',
  }));
  assert.equal(resolve('CALDAV_URL'), 'https://dav.a.example/cal/');
  assert.equal(resolve('DAV_CALENDAR_URL_TEMPLATE'), 'https://dav.a.example/cal/');
  assert.equal(resolve('DAV_TASKS_URL_TEMPLATE'), 'https://dav.a.example/cal/');
  assert.equal(resolve('DAV_CONTACTS_URL_TEMPLATE'), 'https://dav.a.example/card/');
  assert.equal(resolve('CARDDAV_URL'), 'https://dav.a.example/card/');
});

test('presetFor : le type de serveur se déduit d’une adresse saisie à la main', async () => {
  const { presetFor } = await load();
  assert.equal(presetFor('https://mail.a.example/webdav/calendar'), 'mdaemon');
  assert.equal(presetFor('https://cloud.a.example/remote.php/dav/'), 'generic');
});
