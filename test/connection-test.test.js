'use strict';

// POST /api/test : vérification des identifiants d'un client sur les serveurs configurés.
const test = require('node:test');
const assert = require('node:assert/strict');
const util = require('node:util');
const fake = require('./helpers/mail-auth-servers');
const { startConnectionTest, simultaneous } = require('./helpers/test-client');

const USER = 'jean.dupont@example.com';
const SECRET = 'Sécr3t "à ne pas" \\ journaliser';

// Toute la sortie console du fichier est capturée : le mot de passe ne doit jamais y apparaître.
const captured = [];
for (const m of ['log', 'error', 'warn', 'info', 'debug']) {
  const orig = console[m];
  console[m] = (...args) => { captured.push(util.format(...args)); if (process.env.SHOW_LOGS) orig(...args); };
}

let imap, smtp;
const envFor = (extra = {}) => Object.assign({
  CONNECTION_TEST: 'true',
  IMAP_HOST: '127.0.0.1', IMAP_PORT: String(imap.address().port), IMAP_SECURITY: 'SSL/TLS',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_SECURITY: 'STARTTLS',
  PUBLIC_URL: 'https://config.example.com',
}, extra);
const opts = { ca: fake.cert, timeoutMs: 2000 };

test.before(async () => {
  imap = await fake.imapServer({ security: 'SSL/TLS', accounts: { [USER]: SECRET, 'a@example.org': SECRET } });
  smtp = await fake.smtpServer({ security: 'STARTTLS', accounts: { [USER]: SECRET, 'a@example.org': SECRET } });
});
test.after(async () => {
  await imap.stop(); await smtp.stop();
  const all = captured.join('\n');
  assert.ok(!all.includes(SECRET) && !all.includes('Sécr3t') && !all.includes('faux-mot-de-passe'), 'mot de passe trouvé dans la console');
});

test('option désactivée (défaut) : 404, sans lire ni tester quoi que ce soit', async () => {
  const t = await startConnectionTest(Object.assign(envFor(), { CONNECTION_TEST: '' }), opts);
  try {
    const before = imap.log.connections;
    assert.equal((await t.post({ email: USER, password: SECRET })).status, 404);
    assert.equal((await fetch(t.base + '/api/test')).status, 404);
    assert.equal(imap.log.connections, before);
    // Activée dans l'admin : prise en compte sans redémarrage.
    t.settings.save({ CONNECTION_TEST: 'true' });
    assert.equal((await t.post({ email: USER, password: SECRET })).status, 200);
  } finally { await t.close(); }
});

test('bons identifiants : réception puis envoi vérifiés, réponse JSON sans mot de passe ni cache', async () => {
  const t = await startConnectionTest(envFor(), opts);
  try {
    const smtpBefore = smtp.log.logins.length;
    const r = await t.post({ email: USER, password: SECRET });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.match(r.headers.get('content-type'), /^application\/json/);
    const text = await r.text();
    assert.deepEqual(JSON.parse(text), { imap: { status: 'ok' }, smtp: { status: 'ok' } });
    assert.ok(!text.includes('Sécr3t'));
    assert.equal(imap.log.logins.at(-1).pass, SECRET);
    assert.equal(smtp.log.logins.length, smtpBefore + 1);
    assert.equal(smtp.log.logins.at(-1).pass, SECRET);
    assert.equal(smtp.log.mailFrom, 0);
  } finally { await t.close(); }
});

test('mauvais mot de passe : auth_failed, et le SMTP n’est pas contacté', async () => {
  const t = await startConnectionTest(envFor(), opts);
  try {
    const before = smtp.log.connections;
    const r = await t.post({ email: USER, password: 'faux-mot-de-passe' });
    assert.deepEqual(await r.json(), { imap: { status: 'auth_failed' }, smtp: { status: 'skipped' } });
    assert.equal(smtp.log.connections, before);
  } finally { await t.close(); }
});

test('seuls les serveurs configurés sont contactés : un hôte ou un port envoyé par le client est ignoré', async () => {
  const other = await fake.imapServer({ security: 'SSL/TLS', loginReply: () => 'OK' });
  const t = await startConnectionTest(envFor(), opts);
  try {
    const r = await t.post({ email: USER, password: SECRET, host: '127.0.0.1', port: other.address().port, imap: { host: '127.0.0.1', port: other.address().port } });
    assert.equal(r.status, 200);
    assert.equal(other.log.connections, 0);
  } finally { await t.close(); await other.stop(); }
});

test('Origin étrangère ou absente : 403', async () => {
  const t = await startConnectionTest(envFor(), opts);
  try {
    const before = imap.log.connections;
    let r = await t.post({ email: USER, password: SECRET }, { origin: 'https://evil.example' });
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: 'origin' });
    r = await t.post({ email: USER, password: SECRET }, { origin: false });
    assert.equal(r.status, 403);
    // L'origine de PUBLIC_URL est acceptée.
    r = await t.post({ email: USER, password: SECRET }, { origin: 'https://config.example.com' });
    assert.equal(r.status, 200);
    assert.equal(imap.log.connections, before + 1);
  } finally { await t.close(); }
});

test('méthode, type de contenu et taille du corps contrôlés', async () => {
  const t = await startConnectionTest(envFor(), opts);
  try {
    let r = await fetch(t.base + '/api/test');
    assert.equal(r.status, 405);
    assert.equal(r.headers.get('allow'), 'POST');
    r = await t.post(null, { raw: 'email=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    assert.equal(r.status, 415);
    r = await t.post({ email: USER, password: 'x'.repeat(9000) });
    assert.equal(r.status, 413);
    r = await t.post(null, { raw: '{pas du json' });
    assert.equal(r.status, 400);
    r = await t.post(null, { raw: 'null' });
    assert.equal(r.status, 400);
  } finally { await t.close(); }
});

test('adresse ou mot de passe invalides : 422, sans connexion', async () => {
  const t = await startConnectionTest(envFor(), opts);
  try {
    const before = imap.log.connections;
    for (const email of ['', 'jean', 'a@b', 42, null]) {
      const r = await t.post({ email, password: SECRET });
      assert.equal(r.status, 422, String(email));
      assert.deepEqual(await r.json(), { error: 'email' });
    }
    for (const password of ['', undefined, 42, 'a\nb', 'a\u0000b', 'x'.repeat(1025)]) {
      const r = await t.post({ email: USER, password });
      assert.equal(r.status, 422, JSON.stringify(password));
      assert.deepEqual(await r.json(), { error: 'password' });
    }
    assert.equal(imap.log.connections, before);
  } finally { await t.close(); }
});

test('domaine non accepté : 403 { error: "domain" }, sans connexion', async () => {
  const t = await startConnectionTest(envFor({ ALLOWED_DOMAINS: 'Example.COM' }), opts);
  try {
    const before = imap.log.connections;
    const r = await t.post({ email: 'a@example.org', password: SECRET });
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: 'domain' });
    assert.equal(imap.log.connections, before);
    assert.equal((await t.post({ email: 'Jean.Dupont@EXAMPLE.com', password: 'faux-mot-de-passe' })).status, 200);
  } finally { await t.close(); }
});

test('limite par adresse : 5 essais par 15 minutes, puis 429 avec retryAfter', async () => {
  const t = await startConnectionTest(envFor(), opts);
  try {
    for (let i = 0; i < 5; i++) assert.equal((await t.post({ email: USER, password: 'faux-mot-de-passe' })).status, 200, 'essai ' + i);
    const before = imap.log.connections;
    const r = await t.post({ email: 'JEAN.DUPONT@example.com', password: SECRET });
    assert.equal(r.status, 429);
    const body = await r.json();
    assert.equal(body.error, 'rate_limited');
    assert.ok(body.retryAfter > 0 && body.retryAfter <= 900);
    assert.equal(r.headers.get('retry-after'), String(body.retryAfter));
    assert.equal(imap.log.connections, before);
    // Une autre adresse depuis la même IP reste possible.
    assert.equal((await t.post({ email: 'a@example.org', password: SECRET })).status, 200);
  } finally { await t.close(); }
});

test('limite par IP : 20 essais toutes adresses confondues (IP réelle via TRUSTED_PROXY_HEADER)', async () => {
  const t = await startConnectionTest(envFor({ TRUSTED_PROXY_HEADER: 'CF-Connecting-IP', CONNECTION_TEST_MAX_PER_IP: '6' }), opts);
  try {
    for (let i = 0; i < 6; i++) assert.equal((await t.post({ email: `x${i}@example.com`, password: 'faux-mot-de-passe' }, { ip: '203.0.113.7' })).status, 200);
    const r = await t.post({ email: 'y@example.com', password: 'faux-mot-de-passe' }, { ip: '203.0.113.7' });
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error, 'rate_limited');
    assert.equal((await t.post({ email: 'y@example.com', password: 'faux-mot-de-passe' }, { ip: '203.0.113.8' })).status, 200);
  } finally { await t.close(); }
});

test('requêtes simultanées : jamais plus d’essais que la limite n’en permet', async () => {
  const t = await startConnectionTest(envFor(), opts);
  try {
    const before = imap.log.logins.length;
    const codes = await simultaneous(t.base, Array.from({ length: 30 }, () => ({ email: USER, password: 'faux-mot-de-passe' })));
    assert.equal(codes.filter((c) => c === 200).length, 5, JSON.stringify(codes));
    assert.equal(codes.filter((c) => c === 429).length, 25);
    assert.equal(imap.log.logins.length - before, 5);
  } finally { await t.close(); }
});

test('requêtes simultanées depuis une IP : limite par IP respectée aussi', async () => {
  const t = await startConnectionTest(envFor(), opts);
  try {
    const before = imap.log.logins.length;
    const codes = await simultaneous(t.base, Array.from({ length: 40 }, (_, i) => ({ email: `p${i}@example.com`, password: 'faux-mot-de-passe' })));
    assert.equal(codes.filter((c) => c === 200).length, 20, JSON.stringify(codes));
    assert.equal(imap.log.logins.length - before, 20);
  } finally { await t.close(); }
});

test('trop de tests en cours sur l’instance : 503 { error: "busy" }', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const slow = async ({ password }) => { await gate; password.fill(0); return { imap: { status: 'ok' }, smtp: { status: 'ok' } }; };
  const t = await startConnectionTest(envFor(), { test: slow, maxConcurrent: 2 });
  try {
    const p1 = t.post({ email: 'a1@example.com', password: SECRET });
    const p2 = t.post({ email: 'a2@example.com', password: SECRET });
    await new Promise((r) => setTimeout(r, 100));
    const r3 = await t.post({ email: 'a3@example.com', password: SECRET });
    assert.equal(r3.status, 503);
    assert.deepEqual(await r3.json(), { error: 'busy' });
    release();
    assert.equal((await p1).status, 200);
    assert.equal((await p2).status, 200);
  } finally { await t.close(); }
});

test('erreur interne : 500 sans détail, et rien du mot de passe dans le journal', async () => {
  const boom = async ({ password }) => { throw new Error('échec avec ' + password.toString('utf8')); };
  const t = await startConnectionTest(envFor(), { test: boom });
  try {
    const r = await t.post({ email: USER, password: SECRET });
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { error: 'internal' });
  } finally { await t.close(); }
});

test('le mot de passe reçu par la fonction de test est un tampon, remis à zéro après la réponse', async () => {
  let seen = null;
  const spy = async ({ password }) => { seen = password; assert.equal(password.toString('utf8'), SECRET); return { imap: { status: 'ok' }, smtp: { status: 'ok' } }; };
  const t = await startConnectionTest(envFor(), { test: spy });
  try {
    assert.equal((await t.post({ email: USER, password: SECRET })).status, 200);
    assert.ok(Buffer.isBuffer(seen) && seen.every((b) => b === 0));
  } finally { await t.close(); }
});
