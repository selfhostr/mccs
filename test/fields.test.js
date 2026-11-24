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

test('téléphone : même règle dans le navigateur que sur le serveur', async () => {
  const { check } = await load();
  const { VALID, INVALID } = require('./helpers/phones');
  for (const v of VALID) assert.equal(check('phone', v), '', JSON.stringify(v));
  for (const v of INVALID) assert.notEqual(check('phone', v), '', JSON.stringify(v));
});

test('aide du téléphone : exemple neutre, sans indicatif suisse', async () => {
  const { HELP } = await load();
  assert.doesNotMatch(HELP.SUPPORT_PHONE, /\+41/);
  assert.doesNotMatch(HELP.PROFILE_ID_PREFIX, /\bch\./);
});

test('resolver : la valeur intégrée transmise par le serveur (field.default) sert de repli', async () => {
  const { resolver } = await load();
  const m = new Map([['TEST_MSG_IMAP_OK', { field: { key: 'TEST_MSG_IMAP_OK', source: 'admin', default: 'Texte intégré', envValue: '' }, value: '' }]]);
  assert.equal(resolver(m).resolve('TEST_MSG_IMAP_OK'), 'Texte intégré');
  const t = new Map([['CONNECTION_TEST', { field: { key: 'CONNECTION_TEST', source: 'admin', default: 'false', envValue: 'true' }, value: '' }]]);
  assert.equal(resolver(t).resolve('CONNECTION_TEST'), 'true');
});

test('check : interrupteur, nombre d’essais et message, mêmes règles que le serveur', async () => {
  const { check, isOn } = await load();
  assert.equal(check('toggle', 'true'), '');
  assert.notEqual(check('toggle', 'oui'), '');
  assert.equal(check('count', '20'), '');
  for (const bad of ['0', '-3', '1.5', 'x', '10001']) assert.notEqual(check('count', bad), '', bad);
  assert.equal(check('message', 'Ligne 1\nLigne 2'), '');
  assert.notEqual(check('message', 'a\u0007b'), '');
  assert.equal(isOn('true'), true);
  assert.equal(isOn('1'), true);
  assert.equal(isOn('false'), false);
  assert.equal(isOn(''), false);
});

test('référencement : titre par défaut et validation, mêmes règles que le serveur', async () => {
  const { resolver, check } = await load();
  const { defaultTitle } = require('../server/seo');
  const { FIELDS, validateValues } = require('../server/settings');
  assert.equal(resolver(entries({ BRAND_NAME: 'Acme' })).resolve('SEO_TITLE'), defaultTitle('Acme'));
  assert.equal(resolver(entries({})).resolve('SEO_TITLE'), defaultTitle('mccs'));
  const title = FIELDS.find((f) => f.key === 'SEO_TITLE');
  for (const v of ['Titre', 'x'.repeat(80), 'x'.repeat(81), 'a\nb', 'a\u0007b']) {
    assert.equal(check('line', v, title) === '', !validateValues({ SEO_TITLE: v }).SEO_TITLE, JSON.stringify(v));
  }
  for (const v of ['/uploads/share-0123456789abcdef.png', 'https://cdn.acme.example/og.jpg', '/img/logo.svg', 'javascript:x']) {
    assert.equal(check('share-image', v) === '', !validateValues({ SEO_IMAGE: v }).SEO_IMAGE, v);
  }
});
