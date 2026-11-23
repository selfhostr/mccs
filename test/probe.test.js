'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { probe } = require('../server/probe');
const fake = require('./helpers/mail-servers');

const HOST = '127.0.0.1';

test('SSL/TLS : un certificat autosigné est refusé (le certificat est vérifié)', async () => {
  const s = await fake.tlsServer();
  try {
    const r = await probe({ host: HOST, port: s.address().port, security: 'SSL/TLS' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'tls');
    assert.equal(typeof r.detail, 'string');
  } finally { await fake.close(s); }
});

test('SSL/TLS : accueil IMAP lu quand le certificat est reconnu', async () => {
  const s = await fake.tlsServer('* OK IMAP4rev1 prêt');
  try {
    const r = await probe({ host: HOST, port: s.address().port, security: 'SSL/TLS', ca: fake.cert });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.match(r.greeting, /^\* OK IMAP4rev1/);
    assert.deepEqual(r.tls, { authorized: true, subject: 'localhost' });
  } finally { await fake.close(s); }
});

test('SSL/TLS : accueil SMTP accepté', async () => {
  const s = await fake.tlsServer('220 mail.example.test ESMTP');
  try {
    const r = await probe({ host: HOST, port: s.address().port, security: 'SSL/TLS', ca: fake.cert });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.match(r.greeting, /^220 /);
  } finally { await fake.close(s); }
});

test('STARTTLS IMAP : « a STARTTLS » puis passage en TLS', async () => {
  const s = await fake.imapStarttls();
  try {
    const r = await probe({ host: HOST, port: s.address().port, security: 'STARTTLS', ca: fake.cert });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.match(r.greeting, /^\* OK/);
    assert.equal(r.tls.authorized, true);
  } finally { await fake.close(s); }
});

test('STARTTLS SMTP : accueil multiligne, EHLO puis STARTTLS', async () => {
  const s = await fake.smtpStarttls();
  try {
    const r = await probe({ host: HOST, port: s.address().port, security: 'STARTTLS', ca: fake.cert });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.match(r.greeting, /^220/);
    assert.equal(r.tls.subject, 'localhost');
  } finally { await fake.close(s); }
});

test('STARTTLS : certificat autosigné refusé après la commande', async () => {
  const s = await fake.smtpStarttls();
  try {
    const r = await probe({ host: HOST, port: s.address().port, security: 'STARTTLS' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'tls');
  } finally { await fake.close(s); }
});

test('STARTTLS : un serveur qui ne parle ni IMAP ni SMTP donne « protocol »', async () => {
  const s = await fake.wrongProtocol();
  try {
    const r = await probe({ host: HOST, port: s.address().port, security: 'STARTTLS' });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'protocol');
    assert.match(r.detail, /HTTP/);
  } finally { await fake.close(s); }
});

test('port fermé : « unreachable »', async () => {
  const port = await fake.closedPort();
  for (const security of ['SSL/TLS', 'STARTTLS']) {
    const r = await probe({ host: HOST, port, security });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'unreachable', security);
  }
});

test('serveur muet : « timeout » après le délai', async () => {
  const s = await fake.mute();
  try {
    for (const security of ['SSL/TLS', 'STARTTLS']) {
      const t0 = Date.now();
      const r = await probe({ host: HOST, port: s.address().port, security, timeoutMs: 300 });
      assert.equal(r.ok, false);
      assert.equal(r.error, 'timeout', security);
      assert.ok(Date.now() - t0 < 2000);
    }
  } finally { await fake.close(s); }
});
