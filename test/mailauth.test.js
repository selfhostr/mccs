'use strict';

// Client IMAP/SMTP authentifié (server/mailauth.js) contre de faux serveurs locaux.
const test = require('node:test');
const assert = require('node:assert/strict');
const { testImap, testSmtp, testAccount } = require('../server/mailauth');
const fake = require('./helpers/mail-auth-servers');
const { closedPort, mute } = require('./helpers/mail-servers');

const HOST = '127.0.0.1';
const USER = 'jean.dupont@example.com';
const target = (s, security) => ({ host: HOST, port: s.address().port, security, ca: fake.cert, timeoutMs: 2000 });
const pw = (s) => Buffer.from(s, 'utf8');

for (const security of ['SSL/TLS', 'STARTTLS']) {
  test(`IMAP ${security} : bon mot de passe -> ok, connexion chiffrée puis LOGOUT`, async () => {
    const s = await fake.imapServer({ security, accounts: { [USER]: 'secret' } });
    try {
      assert.equal(await testImap(Object.assign(target(s, security), { user: USER, password: pw('secret') })), 'ok');
      assert.deepEqual(s.log.logins, [{ user: USER, pass: 'secret', secure: true }]);
      assert.ok(s.log.commands.includes('LOGOUT'));
    } finally { await s.stop(); }
  });

  test(`IMAP ${security} : mauvais mot de passe -> auth_failed`, async () => {
    const s = await fake.imapServer({ security, accounts: { [USER]: 'secret' } });
    try {
      assert.equal(await testImap(Object.assign(target(s, security), { user: USER, password: pw('faux') })), 'auth_failed');
    } finally { await s.stop(); }
  });

  test(`SMTP ${security} : bon mot de passe -> ok, AUTH PLAIN, aucun message envoyé`, async () => {
    const s = await fake.smtpServer({ security, accounts: { [USER]: 'secret' } });
    try {
      assert.equal(await testSmtp(Object.assign(target(s, security), { user: USER, password: pw('secret') })), 'ok');
      assert.deepEqual(s.log.logins, [{ user: USER, pass: 'secret', mech: 'PLAIN', secure: true }]);
      assert.equal(s.log.mailFrom, 0);
      assert.ok(!s.log.commands.includes('MAIL') && !s.log.commands.includes('RCPT') && !s.log.commands.includes('DATA'));
      assert.ok(s.log.commands.includes('QUIT'));
    } finally { await s.stop(); }
  });
}

test('IMAP : mots de passe avec guillemets, backslash, accents, espaces transmis à l’identique', async () => {
  const cases = ['a"b', 'a\\b', '\\"', 'été àçü', '  espaces  ', 'mélange "\\" ü', '{5}', 'a b"c\\d', '日本語', ')(*%'];
  const s = await fake.imapServer({ security: 'SSL/TLS', loginReply: () => 'OK LOGIN completed' });
  try {
    for (const p of cases) assert.equal(await testImap(Object.assign(target(s, 'SSL/TLS'), { user: USER, password: pw(p) })), 'ok', p);
    assert.deepEqual(s.log.logins.map((l) => l.pass), cases);
    assert.ok(s.log.logins.every((l) => l.user === USER));
  } finally { await s.stop(); }
});

test('SMTP : mêmes mots de passe transmis à l’identique (PLAIN et LOGIN)', async () => {
  const cases = ['a"b', 'a\\b', 'été àçü', '  espaces  ', '日本語'];
  for (const mechs of [['PLAIN', 'LOGIN'], ['LOGIN']]) {
    const s = await fake.smtpServer({ security: 'SSL/TLS', mechs, authReply: () => '235 ok' });
    try {
      for (const p of cases) assert.equal(await testSmtp(Object.assign(target(s, 'SSL/TLS'), { user: USER, password: pw(p) })), 'ok', p);
      assert.deepEqual(s.log.logins.map((l) => l.pass), cases);
      assert.ok(s.log.logins.every((l) => l.mech === mechs[0]));
    } finally { await s.stop(); }
  }
});

test('SMTP : sans mécanisme PLAIN ni LOGIN -> error', async () => {
  const s = await fake.smtpServer({ security: 'SSL/TLS', mechs: ['CRAM-MD5'] });
  try {
    assert.equal(await testSmtp(Object.assign(target(s, 'SSL/TLS'), { user: USER, password: pw('x') })), 'error');
    assert.equal(s.log.logins.length, 0);
  } finally { await s.stop(); }
});

test('compte bloqué : reconnu dans la réponse IMAP ou SMTP -> blocked', async () => {
  const replies = ['NO [AUTHENTICATIONFAILED] Account temporarily locked', 'NO Too many failed login attempts', 'NO [CONTACTADMIN] Compte bloqué', 'BYE Your IP address is blocked'];
  for (const r of replies) {
    const s = await fake.imapServer({ security: 'SSL/TLS', loginReply: () => r });
    try { assert.equal(await testImap(Object.assign(target(s, 'SSL/TLS'), { user: USER, password: pw('x') })), 'blocked', r); } finally { await s.stop(); }
  }
  const g = await fake.imapServer({ security: 'SSL/TLS', greeting: '* BYE Connection refused by Dynamic Screening' });
  try { assert.equal(await testImap(Object.assign(target(g, 'SSL/TLS'), { user: USER, password: pw('x') })), 'blocked'); } finally { await g.stop(); }
  const m = await fake.smtpServer({ security: 'SSL/TLS', authReply: () => '535 5.7.8 Account locked: too many failures' });
  try { assert.equal(await testSmtp(Object.assign(target(m, 'SSL/TLS'), { user: USER, password: pw('x') })), 'blocked'); } finally { await m.stop(); }
  const sg = await fake.smtpServer({ security: 'SSL/TLS', greeting: '554 5.7.1 Your IP is blacklisted' });
  try { assert.equal(await testSmtp(Object.assign(target(sg, 'SSL/TLS'), { user: USER, password: pw('x') })), 'blocked'); } finally { await sg.stop(); }
});

test('« Plaintext authentication disabled » n’est pas pris pour un blocage', async () => {
  const s = await fake.imapServer({ security: 'SSL/TLS', loginReply: () => 'NO [AUTHENTICATIONFAILED] Authentication failed.' });
  try { assert.equal(await testImap(Object.assign(target(s, 'SSL/TLS'), { user: USER, password: pw('x') })), 'auth_failed'); } finally { await s.stop(); }
});

test('certificat non reconnu -> tls_error (SSL/TLS et STARTTLS)', async () => {
  for (const security of ['SSL/TLS', 'STARTTLS']) {
    const s = await fake.imapServer({ security, accounts: { [USER]: 'secret' } });
    try {
      const t = Object.assign(target(s, security), { user: USER, password: pw('secret'), ca: undefined });
      assert.equal(await testImap(t), 'tls_error', security);
      assert.equal(s.log.logins.length, 0, 'aucun mot de passe envoyé sans TLS valide');
    } finally { await s.stop(); }
  }
});

test('serveur muet -> timeout dans le délai', async () => {
  const s = await mute();
  try {
    for (const security of ['SSL/TLS', 'STARTTLS']) {
      const t0 = Date.now();
      assert.equal(await testImap({ host: HOST, port: s.address().port, security, user: USER, password: pw('x'), timeoutMs: 300 }), 'timeout');
      assert.equal(await testSmtp({ host: HOST, port: s.address().port, security, user: USER, password: pw('x'), timeoutMs: 300 }), 'timeout');
      assert.ok(Date.now() - t0 < 2000);
    }
  } finally { await new Promise((r) => { s.close(r); }); }
});

test('port fermé -> unreachable', async () => {
  const port = await closedPort();
  for (const security of ['SSL/TLS', 'STARTTLS']) {
    assert.equal(await testImap({ host: HOST, port, security, user: USER, password: pw('x'), timeoutMs: 2000 }), 'unreachable');
    assert.equal(await testSmtp({ host: HOST, port, security, user: USER, password: pw('x'), timeoutMs: 2000 }), 'unreachable');
  }
});

test('testAccount : SMTP sauté si IMAP échoue, testé après un IMAP réussi', async () => {
  const imap = await fake.imapServer({ security: 'SSL/TLS', accounts: { [USER]: 'secret' } });
  const smtp = await fake.smtpServer({ security: 'STARTTLS', accounts: { [USER]: 'secret' } });
  try {
    const cfg = { imap: target(imap, 'SSL/TLS'), smtp: target(smtp, 'STARTTLS'), ca: fake.cert, timeoutMs: 2000 };
    assert.deepEqual(await testAccount(Object.assign({ user: USER, password: pw('faux') }, cfg)), { imap: { status: 'auth_failed' }, smtp: { status: 'skipped' } });
    assert.equal(smtp.log.connections, 0);
    assert.deepEqual(await testAccount(Object.assign({ user: USER, password: pw('secret') }, cfg)), { imap: { status: 'ok' }, smtp: { status: 'ok' } });
    assert.equal(smtp.log.logins.length, 1);
  } finally { await imap.stop(); await smtp.stop(); }
});

test('testAccount : le tampon du mot de passe est remis à zéro à la fin', async () => {
  const imap = await fake.imapServer({ security: 'SSL/TLS', accounts: { [USER]: 'secret' } });
  const smtp = await fake.smtpServer({ security: 'SSL/TLS', accounts: { [USER]: 'secret' } });
  try {
    const password = pw('secret');
    const r = await testAccount({ user: USER, password, imap: target(imap, 'SSL/TLS'), smtp: target(smtp, 'SSL/TLS'), ca: fake.cert, timeoutMs: 2000 });
    assert.equal(r.smtp.status, 'ok');
    assert.ok(password.every((b) => b === 0));
  } finally { await imap.stop(); await smtp.stop(); }
});
