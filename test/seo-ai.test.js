'use strict';

// public/support/seo.js (module du navigateur) : prompt pour une IA, lecture de sa réponse, compteurs, troncature.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FIELDS } = require('../server/settings');

// Chargé comme module ES depuis son texte (aucun import dans ce fichier), comme fields.js.
const SRC = fs.readFileSync(path.join(__dirname, '../public/support/seo.js'), 'utf8');
const load = () => import('data:text/javascript;charset=utf-8,' + encodeURIComponent(SRC));

const TITLE = 'Configurer sa messagerie Acme : e-mail et agenda';
const DESC = 'Configurez votre adresse e-mail Acme, votre calendrier et vos contacts sur ordinateur, iPhone ou Android, avec un guide pas à pas.';
const JSON_TEXT = JSON.stringify({ SEO_TITLE: TITLE, SEO_DESCRIPTION: DESC, SEO_INDEX: 'true' }, null, 2);

test('limites : les mêmes que celles du serveur', async () => {
  const { LIMITS } = await load();
  for (const k of ['SEO_TITLE', 'SEO_DESCRIPTION']) {
    const f = FIELDS.find((x) => x.key === k);
    assert.deepEqual(LIMITS[k], { max: f.max, advice: f.advice }, k);
  }
});

test('réponse : JSON nu', async () => {
  const { parseAiAnswer } = await load();
  assert.deepEqual(parseAiAnswer(JSON_TEXT), { values: { SEO_TITLE: TITLE, SEO_DESCRIPTION: DESC, SEO_INDEX: 'true' }, problems: [] });
});

test('réponse : bloc ```json``` entouré de texte', async () => {
  const { parseAiAnswer } = await load();
  const text = 'Voici ma proposition :\n\n```json\n' + JSON_TEXT + '\n```\n\nJ’ai gardé le nom {Acme} au début du titre.';
  assert.deepEqual(parseAiAnswer(text).values, { SEO_TITLE: TITLE, SEO_DESCRIPTION: DESC, SEO_INDEX: 'true' });
  assert.deepEqual(parseAiAnswer(text).problems, []);
});

test('réponse : bloc ``` sans langue, ou objet au milieu du texte, accolades dans les chaînes comprises', async () => {
  const { parseAiAnswer } = await load();
  assert.equal(parseAiAnswer('```\n' + JSON_TEXT + '\n```').values.SEO_TITLE, TITLE);
  const inline = 'Proposition : {"SEO_TITLE": "Acme {mail}", "SEO_DESCRIPTION": "' + DESC + '", "SEO_INDEX": false} Voilà.';
  assert.deepEqual(parseAiAnswer(inline).values, { SEO_TITLE: 'Acme {mail}', SEO_DESCRIPTION: DESC, SEO_INDEX: 'false' });
});

test('réponse : seul le premier bloc JSON compte', async () => {
  const { parseAiAnswer } = await load();
  const text = '```json\n{"SEO_TITLE": "Premier titre de la page Acme"}\n```\n```json\n{"SEO_TITLE": "Second"}\n```';
  assert.equal(parseAiAnswer(text).values.SEO_TITLE, 'Premier titre de la page Acme');
});

test('réponse : JSON invalide ou absent, signalé clairement', async () => {
  const { parseAiAnswer } = await load();
  for (const text of ['', '   ', 'Pas de JSON ici.', '```json\n{"SEO_TITLE": "x",}\n```', '{"SEO_TITLE": "non fermé"', '```json\n["SEO_TITLE"]\n```']) {
    const r = parseAiAnswer(text);
    assert.deepEqual(r.values, {}, JSON.stringify(text));
    assert.equal(r.problems.length, 1, JSON.stringify(text));
  }
  assert.match(parseAiAnswer('Pas de JSON ici.').problems[0], /Aucun bloc JSON/);
  assert.match(parseAiAnswer('```json\n{"SEO_TITLE": "x",}\n```').problems[0], /JSON invalide/);
});

test('réponse : clés inconnues ignorées, clés absentes signalées, casse des clés tolérée', async () => {
  const { parseAiAnswer } = await load();
  const r = parseAiAnswer(JSON.stringify({ seo_title: TITLE, SEO_KEYWORDS: 'mail', BRAND_NAME: 'Pirate' }));
  assert.deepEqual(r.values, { SEO_TITLE: TITLE });
  assert.ok(r.problems.some((p) => /SEO_KEYWORDS/.test(p) && /ignorée/.test(p)));
  assert.ok(r.problems.some((p) => /BRAND_NAME/.test(p)));
  assert.ok(r.problems.some((p) => /SEO_DESCRIPTION/.test(p) && /absente/.test(p)));
  assert.ok(r.problems.some((p) => /SEO_INDEX/.test(p) && /absente/.test(p)));
  assert.ok(!('BRAND_NAME' in r.values));
});

test('réponse : valeurs trop longues, vides, de mauvais type ou avec caractères de contrôle refusées', async () => {
  const { parseAiAnswer } = await load();
  const r = parseAiAnswer(JSON.stringify({ SEO_TITLE: 'x'.repeat(81), SEO_DESCRIPTION: 'y'.repeat(201), SEO_INDEX: 'peut-être' }));
  assert.deepEqual(r.values, {});
  assert.ok(r.problems.some((p) => /SEO_TITLE/.test(p) && /81/.test(p) && /80/.test(p)));
  assert.ok(r.problems.some((p) => /SEO_DESCRIPTION/.test(p) && /201/.test(p) && /200/.test(p)));
  assert.ok(r.problems.some((p) => /SEO_INDEX/.test(p)));
  const s = parseAiAnswer(JSON.stringify({ SEO_TITLE: '  ', SEO_DESCRIPTION: 42, SEO_INDEX: 'TRUE' }));
  assert.deepEqual(s.values, { SEO_INDEX: 'true' });
  assert.equal(s.problems.length, 2);
  assert.deepEqual(parseAiAnswer(JSON.stringify({ SEO_TITLE: 'a\u0007b' })).values, {});
});

test('réponse : retours à la ligne et espaces multiples ramenés à une espace', async () => {
  const { parseAiAnswer } = await load();
  const r = parseAiAnswer(JSON.stringify({ SEO_DESCRIPTION: '  Ligne une.\nLigne   deux.  ' }));
  assert.equal(r.values.SEO_DESCRIPTION, 'Ligne une. Ligne deux.');
});

test('compteur : zones conseillées', async () => {
  const { lengthState, LIMITS } = await load();
  assert.deepEqual(lengthState('', LIMITS.SEO_TITLE), { n: 0, state: 'empty' });
  assert.equal(lengthState('x'.repeat(29), LIMITS.SEO_TITLE).state, 'short');
  assert.equal(lengthState('x'.repeat(30), LIMITS.SEO_TITLE).state, 'ok');
  assert.equal(lengthState('x'.repeat(60), LIMITS.SEO_TITLE).state, 'ok');
  assert.equal(lengthState('x'.repeat(61), LIMITS.SEO_TITLE).state, 'long');
  assert.equal(lengthState('x'.repeat(81), LIMITS.SEO_TITLE).state, 'over');
  assert.equal(lengthState('𝔸'.repeat(30), LIMITS.SEO_TITLE).n, 30);
});

test('troncature façon Google : au dernier mot entier, avec points de suspension', async () => {
  const { truncate } = await load();
  assert.equal(truncate('Court', 60), 'Court');
  assert.equal(truncate('un deux trois quatre', 12), 'un deux…');
  assert.equal(truncate('x'.repeat(20), 10), 'x'.repeat(9) + '…');
  assert.ok([...truncate('mot '.repeat(50), 60)].length <= 60);
});

test('prompt : rôle, questions d’abord, format JSON exact et contexte de la configuration', async () => {
  const { buildPrompt } = await load();
  const p = buildPrompt({
    brand: 'Acme', organization: 'Acme SA', publicUrl: 'https://config.acme.example', domains: ['acme.example', 'acme.org'],
    mailHost: 'mail.acme.example', webmailUrl: 'https://mail.acme.example/', davPreset: 'generic',
    support: { phone: '+41 22 123 45 67', email: 'support@acme.example', hours: 'Du lundi au vendredi' },
    seo: { title: 'Titre actuel', description: 'Description actuelle', index: false },
  });
  assert.match(p, /experte en référencement/);
  for (const s of ['Acme SA', 'https://config.acme.example', 'acme.example, acme.org', 'mail.acme.example', '+41 22 123 45 67', 'support@acme.example', 'Titre actuel', 'Description actuelle']) {
    assert.ok(p.includes(s), s);
  }
  assert.match(p, /calendrier/);
  assert.match(p, /contacts/);
  assert.match(p, /iPhone/);
  assert.match(p, /Android/);
  assert.match(p, /3 à 5 questions/);
  assert.match(p, /attends? mes réponses/);
  assert.match(p, /```json/);
  for (const k of ['"SEO_TITLE"', '"SEO_DESCRIPTION"', '"SEO_INDEX"']) assert.ok(p.includes(k), k);
  assert.match(p, /30 et 60 caractères/);
  assert.match(p, /120 et 160 caractères/);
  assert.match(p, /promesse/);
  assert.match(p, /explication/);
});

test('prompt : valeurs absentes décrites sans trou', async () => {
  const { buildPrompt } = await load();
  const p = buildPrompt({ brand: 'mccs', domains: [], seo: { title: 'T', description: 'D', index: true } });
  assert.match(p, /toutes les adresses/i);
  assert.match(p, /pas encore renseignée/);
  assert.doesNotMatch(p, /undefined|null/);
});
