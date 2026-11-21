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
