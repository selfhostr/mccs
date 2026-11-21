'use strict';

// Durcissement après relecture : course sur le verrouillage, en-tête d'IP, admin.json corrompu.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { client, startAdmin } = require('./helpers/admin-client');

const PW = 'mot-de-passe-initial';

// Envoie l'en-tête et le début du corps, puis termine toutes les requêtes en même temps.
function delayedLogins(base, n, headers = {}) {
  const u = new URL(base);
  const body = JSON.stringify({ user: 'support', password: 'faux' });
  const reqs = [];
  const done = [];
  for (let i = 0; i < n; i++) {
    done.push(new Promise((resolve) => {
      const req = http.request({
        host: u.hostname, port: u.port, method: 'POST', path: '/support/api/login',
        headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Origin: base }, headers),
      }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', () => resolve(0));
      req.write(body.slice(0, 5));
      reqs.push(req);
    }));
  }
  return new Promise((r) => setTimeout(r, 300)).then(() => {
    reqs.forEach((req) => req.end(body.slice(5)));
    return Promise.all(done);
  });
}

test('des connexions simultanées ne testent pas plus de 10 mots de passe', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: PW, PUBLIC_URL: 'http://127.0.0.1' });
  try {
    const codes = await delayedLogins(a.base, 40);
    assert.ok(codes.filter((c) => c === 401).length <= 10, JSON.stringify(codes));
    assert.ok(codes.filter((c) => c === 429).length >= 30);
  } finally { await a.close(); }
});

test('CF-Connecting-IP est ignoré par défaut', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: PW, PUBLIC_URL: 'http://127.0.0.1' });
  try {
    const c = client(a.base);
    for (let i = 0; i < 10; i++) await c.login('faux', { ip: `203.0.113.${i}` });
    const r = await c.login(PW, { ip: '203.0.113.200' });
    assert.equal(r.r.status, 429);
  } finally { await a.close(); }
});

test('CF-Connecting-IP est utilisé si TRUSTED_PROXY_HEADER le demande', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: PW, PUBLIC_URL: 'http://127.0.0.1', TRUSTED_PROXY_HEADER: 'CF-Connecting-IP' });
  try {
    const c = client(a.base);
    for (let i = 0; i < 10; i++) await c.login('faux', { ip: '203.0.113.1' });
    assert.equal((await c.login(PW, { ip: '203.0.113.1' })).r.status, 429);
    assert.equal((await c.login(PW, { ip: '203.0.113.2' })).r.status, 200);
  } finally { await a.close(); }
});

test('X-Forwarded-For : seule la dernière adresse (ajoutée par le proxy) compte', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: PW, PUBLIC_URL: 'http://127.0.0.1', TRUSTED_PROXY_HEADER: 'X-Forwarded-For' });
  try {
    const c = client(a.base);
    for (let i = 0; i < 10; i++) await c.login('faux', { headers: { 'X-Forwarded-For': `10.0.0.${i}, 203.0.113.9` } });
    assert.equal((await c.login(PW, { headers: { 'X-Forwarded-For': '10.0.0.99, 203.0.113.9' } })).r.status, 429);
  } finally { await a.close(); }
});

test('un admin.json corrompu bloque la connexion au lieu de réactiver SUPPORT_PASSWORD', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: PW, PUBLIC_URL: 'http://127.0.0.1' });
  try {
    fs.writeFileSync(path.join(a.dir, 'admin.json'), '{"version":2}');
    const r = await client(a.base).login(PW);
    assert.equal(r.r.status, 503);
    assert.equal(r.cookie, undefined);
  } finally { await a.close(); }
});

test('setup-done ne réécrit pas un admin.json illisible', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: PW, PUBLIC_URL: 'http://127.0.0.1' });
  try {
    const c = client(a.base);
    const { cookie } = await c.login(PW);
    const original = '{"version":2,"password":{"salt":"x","hash":"y"}}';
    fs.writeFileSync(path.join(a.dir, 'admin.json'), original);
    const r = await c.call('POST', '/support/api/setup-done', { cookie });
    assert.notEqual(r.status, 200);
    assert.equal(fs.readFileSync(path.join(a.dir, 'admin.json'), 'utf8'), original);
  } finally { await a.close(); }
});

test('describe donne la valeur du .env d’un réglage modifié ici', async () => {
  const a = await startAdmin({ SUPPORT_PASSWORD: PW, MAIL_HOST: 'mail.env.ch' });
  try {
    a.settings.save({ MAIL_HOST: 'mail.admin.ch', IMAP_PORT: '143' });
    const by = Object.fromEntries(a.settings.describe().map((f) => [f.key, f]));
    assert.equal(by.MAIL_HOST.source, 'admin');
    assert.equal(by.MAIL_HOST.envValue, 'mail.env.ch');
    assert.equal(by.IMAP_PORT.envValue, '');
  } finally { await a.close(); }
});
