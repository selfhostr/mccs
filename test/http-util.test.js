'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWindowCounter, clientIp, originOk } = require('../server/http-util');

test('compteur : les essais s’additionnent par clé dans la fenêtre', () => {
  const c = createWindowCounter({ windowMs: 60000 });
  assert.equal(c.count('a'), 0);
  assert.equal(c.hit('a'), 1);
  assert.equal(c.hit('a'), 2);
  assert.equal(c.hit('b'), 1);
  assert.equal(c.count('a'), 2);
  assert.ok(c.retryAfter('a') > 0 && c.retryAfter('a') <= 60);
  c.delete('a');
  assert.equal(c.count('a'), 0);
});

test('compteur : une fenêtre terminée repart de zéro', async () => {
  const c = createWindowCounter({ windowMs: 30 });
  c.hit('a'); c.hit('a');
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(c.count('a'), 0);
  assert.equal(c.hit('a'), 1);
});

test('compteur : la taille reste bornée sans perdre la clé courante', () => {
  const c = createWindowCounter({ windowMs: 60000, maxEntries: 10 });
  for (let i = 0; i < 50; i++) c.hit('k' + i);
  assert.equal(c.count('k49'), 1);
  assert.equal(c.count('k0'), 0);
});

test('clientIp : en-tête de proxy seulement s’il est déclaré', () => {
  const req = (headers) => ({ headers, socket: { remoteAddress: '10.0.0.1' } });
  assert.equal(clientIp(req({ 'cf-connecting-ip': '203.0.113.1' }), ''), '10.0.0.1');
  assert.equal(clientIp(req({ 'cf-connecting-ip': '203.0.113.1' }), 'cf-connecting-ip'), '203.0.113.1');
  assert.equal(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }), 'x-forwarded-for'), '203.0.113.9');
});

test('originOk : même hôte ou origine de PUBLIC_URL', () => {
  const req = (origin, host = 'a.example') => ({ headers: { origin, host } });
  assert.equal(originOk(req('https://a.example'), 'https://b.example'), true);
  assert.equal(originOk(req('https://b.example'), 'https://b.example/x'), true);
  assert.equal(originOk(req('https://evil.example'), 'https://b.example'), false);
  assert.equal(originOk(req(undefined), 'https://b.example'), false);
  assert.equal(originOk(req('null'), 'https://b.example'), false);
});
