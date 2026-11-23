'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateValues, FIELDS, ENV_ONLY } = require('../server/settings');

test('accepte des valeurs valides', () => {
  assert.deepEqual(validateValues({
    IMAP_PORT: '993',
    BRAND_ACCENT: '#1f5f8b',
    MAIL_HOST: 'mail.acme.ch',
    WEBMAIL_URL: 'https://mail.acme.ch/',
    SUPPORT_EMAIL: 'support@acme.ch',
    DAV_PRESET: 'generic',
    IMAP_SECURITY: 'STARTTLS',
    DAV_CALENDAR_URL_TEMPLATE: 'https://mail.acme.ch/dav/{domain}/{local}/',
  }), {});
});

test('une valeur vide est toujours valide (retour au défaut)', () => {
  assert.deepEqual(validateValues({ IMAP_PORT: '', MAIL_HOST: '' }), {});
});

test('refuse les valeurs invalides, clé par clé', () => {
  const errors = validateValues({
    IMAP_PORT: '70000',
    BRAND_ACCENT: 'red',
    MAIL_HOST: 'bad host',
    WEBMAIL_URL: 'javascript:alert(1)',
    SUPPORT_EMAIL: 'x',
    DAV_PRESET: 'other',
    IMAP_SECURITY: 'NONE',
  });
  for (const k of ['IMAP_PORT', 'BRAND_ACCENT', 'MAIL_HOST', 'WEBMAIL_URL', 'SUPPORT_EMAIL', 'DAV_PRESET', 'IMAP_SECURITY']) {
    assert.equal(typeof errors[k], 'string', k);
  }
});

test('refuse les clés réservées à l’environnement et les clés inconnues', () => {
  const errors = validateValues({ SUPPORT_PASSWORD: 'x', NOPE: 'x' });
  assert.ok(errors.SUPPORT_PASSWORD);
  assert.ok(errors.NOPE);
  assert.ok(ENV_ONLY.includes('SUPPORT_PASSWORD'));
});

test('fond de page : couleur, dégradé ou image envoyée', () => {
  assert.deepEqual(validateValues({ BRAND_BACKGROUND: '#eef1f5' }), {});
  assert.deepEqual(validateValues({ BRAND_BACKGROUND: '#112233,#445566' }), {});
  assert.deepEqual(validateValues({ BRAND_BACKGROUND: '/uploads/fond.webp' }), {});
  assert.ok(validateValues({ BRAND_BACKGROUND: 'url(x)' }).BRAND_BACKGROUND);
  assert.ok(validateValues({ BRAND_BACKGROUND: '/etc/passwd' }).BRAND_BACKGROUND);
});

test('refuse les valeurs trop longues ou non textuelles', () => {
  assert.ok(validateValues({ BRAND_NAME: 'x'.repeat(501) }).BRAND_NAME);
  assert.ok(validateValues({ BRAND_NAME: 42 }).BRAND_NAME);
});

test('chaque champ a une clé, un groupe, un libellé et un type', () => {
  assert.ok(FIELDS.length > 20);
  for (const f of FIELDS) {
    assert.ok(f.key && f.group && f.label && f.type, JSON.stringify(f));
    assert.ok(!ENV_ONLY.includes(f.key), f.key);
  }
});

test('domaines acceptés : liste séparée par des virgules, vide = tous', () => {
  assert.deepEqual(validateValues({ ALLOWED_DOMAINS: 'acme.ch' }), {});
  assert.deepEqual(validateValues({ ALLOWED_DOMAINS: 'acme.ch, Acme.FR ,mail.acme.de' }), {});
  assert.deepEqual(validateValues({ ALLOWED_DOMAINS: '' }), {});
  for (const bad of ['acme', 'acme.ch,,acme.fr', 'acme.ch;acme.fr', '*.acme.ch', 'user@acme.ch', 'acme.ch,']) {
    assert.ok(validateValues({ ALLOWED_DOMAINS: bad }).ALLOWED_DOMAINS, bad);
  }
  const f = FIELDS.find((x) => x.key === 'ALLOWED_DOMAINS');
  assert.equal(f.group, 'servers');
  assert.equal(f.type, 'domains');
});

test('téléphone : formats usuels de tous pays acceptés, lettres et caractères de contrôle refusés', () => {
  const { VALID, INVALID } = require('./helpers/phones');
  for (const v of VALID) assert.deepEqual(validateValues({ SUPPORT_PHONE: v }), {}, JSON.stringify(v));
  // La valeur est validée telle quelle (sans retirer d'abord les caractères de contrôle en fin de chaîne).
  for (const v of INVALID) assert.equal(typeof validateValues({ SUPPORT_PHONE: v }).SUPPORT_PHONE, 'string', JSON.stringify(v));
});
