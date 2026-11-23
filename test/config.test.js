'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSettings } = require('../server/config');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-config-'));

test('les valeurs déduites suivent MAIL_HOST modifié dans l’admin', () => {
  const { config, settings } = createSettings({ env: { MAIL_HOST: 'mail.a.ch' }, dir: tmp() });
  assert.equal(config.imap.host, 'mail.a.ch');
  assert.deepEqual(settings.save({ MAIL_HOST: 'mail.b.ch' }), { ok: true });
  assert.equal(config.imap.host, 'mail.b.ch');
  assert.equal(config.smtp.host, 'mail.b.ch');
  assert.equal(config.webmailUrl, 'https://mail.b.ch/');
});

test('une valeur vide ramène à la valeur déduite', () => {
  const { config, settings } = createSettings({ env: { MAIL_HOST: 'mail.a.ch' }, dir: tmp() });
  settings.save({ IMAP_HOST: 'imap.b.ch' });
  assert.equal(config.imap.host, 'imap.b.ch');
  settings.save({ IMAP_HOST: '' });
  assert.equal(config.imap.host, 'mail.a.ch');
});

test('describe indique la provenance de chaque valeur', () => {
  const { settings } = createSettings({ env: { MAIL_HOST: 'mail.a.ch' }, dir: tmp() });
  settings.save({ BRAND_NAME: 'Acme' });
  const by = Object.fromEntries(settings.describe().map((f) => [f.key, f]));
  assert.equal(by.BRAND_NAME.source, 'admin');
  assert.equal(by.BRAND_NAME.value, 'Acme');
  assert.equal(by.MAIL_HOST.source, 'env');
  assert.equal(by.SMTP_PORT.source, 'default');
  assert.equal(by.SMTP_PORT.effective, '465');
  assert.equal(by.IMAP_HOST.effective, 'mail.a.ch');
});

test('une valeur invalide n’écrit rien', () => {
  const dir = tmp();
  const { config, settings } = createSettings({ env: {}, dir });
  const r = settings.save({ IMAP_PORT: 'x', BRAND_NAME: 'Acme' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.IMAP_PORT);
  assert.equal(config.brand, 'mccs');
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false);
});

test('le préréglage generic change les URL DAV non surchargées', () => {
  const { config, settings } = createSettings({ env: { MAIL_HOST: 'mail.a.ch' }, dir: tmp() });
  settings.save({ DAV_PRESET: 'generic' });
  assert.match(config.caldavUrl, /\/\.well-known\/caldav$/);
});

test('sans DAV_PRESET, les URL MDaemon restent exactement celles d’avant (compatibilité)', () => {
  const { config } = createSettings({ env: { MAIL_HOST: 'mail.a.example' }, dir: tmp() });
  const B = 'https://mail.a.example';
  assert.equal(config.davPreset, 'mdaemon');
  assert.equal(config.caldavUrl, B + '/webdav/calendar');
  assert.equal(config.carddavUrl, B + '/webdav/addressbook');
  assert.equal(config.tasksUrl, B + '/webdav/tasklist');
  assert.equal(config.davDiscoveryUrl, B + '/.well-known/caldav');
  assert.equal(config.davCardDiscoveryUrl, B + '/.well-known/carddav');
  assert.deepEqual(config.davTemplates, {
    principal: B + '/webdav/principals/{email}/',
    calendar: B + '/webdav/caldav/{domain}/{local}/b64=Q2FsZW5kYXI/',
    tasks: B + '/webdav/caldav/{domain}/{local}/b64=VGFza3M/',
    contacts: B + '/webdav/carddav/{domain}/{local}/b64=Q29udGFjdHM/',
  });
});

test('generic sans URL découverte : toutes les adresses restent /.well-known (comme avant)', () => {
  const { config } = createSettings({ env: { MAIL_HOST: 'mail.a.example', DAV_PRESET: 'generic' }, dir: tmp() });
  const cal = 'https://mail.a.example/.well-known/caldav';
  const card = 'https://mail.a.example/.well-known/carddav';
  assert.deepEqual([config.caldavUrl, config.carddavUrl, config.tasksUrl], [cal, card, cal]);
  assert.deepEqual(config.davTemplates, { principal: cal, calendar: cal, tasks: cal, contacts: card });
});

test('generic : les URL découvertes (DAV_DISCOVERY_URL…) deviennent les adresses de l’agenda et des contacts', () => {
  const { config, settings } = createSettings({ env: { MAIL_HOST: 'mail.a.example' }, dir: tmp() });
  assert.deepEqual(settings.save({
    DAV_PRESET: 'generic',
    DAV_DISCOVERY_URL: 'https://dav.a.example/dav/calendars',
    DAV_CARD_DISCOVERY_URL: 'https://dav.a.example/dav/addressbooks',
  }), { ok: true });
  const cal = 'https://dav.a.example/dav/calendars';
  const card = 'https://dav.a.example/dav/addressbooks';
  assert.deepEqual([config.caldavUrl, config.carddavUrl, config.tasksUrl], [cal, card, cal]);
  assert.deepEqual(config.davTemplates, { principal: cal, calendar: cal, tasks: cal, contacts: card });
});

test('mdaemon : une URL de découverte modifiée ne change pas les gabarits MDaemon', () => {
  const { config, settings } = createSettings({ env: { MAIL_HOST: 'mail.a.example' }, dir: tmp() });
  settings.save({ DAV_DISCOVERY_URL: 'https://mail.a.example/webdav/principals/' });
  assert.equal(config.davTemplates.calendar, 'https://mail.a.example/webdav/caldav/{domain}/{local}/b64=Q2FsZW5kYXI/');
});

test('onChange est appelé une fois par enregistrement réussi', () => {
  const { settings } = createSettings({ env: {}, dir: tmp() });
  let n = 0;
  settings.onChange(() => { n++; });
  settings.save({ BRAND_NAME: 'Acme' });
  settings.save({ IMAP_PORT: 'x' });
  assert.equal(n, 1);
});

test('les réglages enregistrés sont relus au démarrage suivant', () => {
  const dir = tmp();
  createSettings({ env: {}, dir }).settings.save({ BRAND_NAME: 'Acme' });
  assert.equal(createSettings({ env: {}, dir }).config.brand, 'Acme');
});

test('restorePrevious recharge la version précédente', () => {
  const { config, settings } = createSettings({ env: {}, dir: tmp() });
  settings.save({ BRAND_NAME: 'Un' });
  settings.save({ BRAND_NAME: 'Deux' });
  assert.equal(settings.restorePrevious(), true);
  assert.equal(config.brand, 'Un');
});

test('sans dossier modifiable, save est refusé', () => {
  const { settings } = createSettings({ env: {}, dir: path.join(tmp(), 'absent') });
  assert.equal(settings.writable, false);
  const r = settings.save({ BRAND_NAME: 'Acme' });
  assert.equal(r.ok, false);
});

test('le fond de page validé est exposé', () => {
  const { config, settings } = createSettings({ env: {}, dir: tmp() });
  assert.equal(config.brandBackground, '');
  settings.save({ BRAND_BACKGROUND: '#112233,#445566' });
  assert.equal(config.brandBackground, '#112233,#445566');
});

test('l’objet config est le même avant et après rechargement', () => {
  const { config, settings } = createSettings({ env: {}, dir: tmp() });
  const imap = config.imap;
  settings.save({ IMAP_PORT: '143' });
  assert.equal(config.imap.port, 143);
  assert.equal(imap.port, 143);
});

// --- Relecture finale ---

test('un fichier illisible est mis de côté avant le premier enregistrement', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ version: 2, values: { BRAND_NAME: 'Futur' } }));
  const { settings } = createSettings({ env: {}, dir });
  assert.deepEqual(settings.save({ BRAND_NAME: 'Acme' }), { ok: true });
  settings.save({ BRAND_NAME: 'Acme 2' });
  const kept = fs.readdirSync(dir).filter((f) => f.startsWith('config.json.bad-'));
  assert.equal(kept.length, 1);
  assert.match(fs.readFileSync(path.join(dir, kept[0]), 'utf8'), /Futur/);
});

test('les clés inconnues du fichier sont conservées lors d’un enregistrement', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ version: 1, values: { FUTURE_KEY: 'x', BRAND_NAME: 'A' } }));
  const { settings } = createSettings({ env: {}, dir });
  settings.save({ BRAND_NAME: 'B' });
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  assert.deepEqual(data.values, { FUTURE_KEY: 'x', BRAND_NAME: 'B' });
});

test('une erreur d’écriture renvoie ok:false sans exception ni fichier temporaire', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'config.json'));
  const { settings } = createSettings({ env: {}, dir });
  const r = settings.save({ BRAND_NAME: 'Acme' });
  assert.equal(r.ok, false);
  assert.ok(r.errors._);
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
});

test('un patch qui n’est pas un objet simple est refusé sans rien écrire', () => {
  const dir = tmp();
  const { settings } = createSettings({ env: {}, dir });
  for (const p of [null, [], 42, 'x']) assert.equal(settings.save(p).ok, false, JSON.stringify(p));
  assert.equal(settings.save(JSON.parse('{"__proto__":"x"}')).ok, false);
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false);
});

test('les clés réservées écrites à la main dans le fichier sont ignorées', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ version: 1, values: { SUPPORT_PASSWORD: 'pirate', PORT: '1' } }));
  const { config } = createSettings({ env: { SUPPORT_PASSWORD: 'vrai' }, dir });
  assert.equal(config.supportAuth.password, 'vrai');
  assert.equal(config.port, 8080);
});

test('les espaces autour des valeurs du fichier sont retirés', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ version: 1, values: { MAIL_HOST: ' mail.sp.ch ' } }));
  assert.equal(createSettings({ env: {}, dir }).config.imap.host, 'mail.sp.ch');
});

test('ALLOWED_DOMAINS donne config.allowedDomains (minuscules, sans espaces ; vide = [])', () => {
  const { config, settings } = createSettings({ env: { ALLOWED_DOMAINS: 'Acme.ch' }, dir: tmp() });
  assert.deepEqual(config.allowedDomains, ['acme.ch']);
  settings.save({ ALLOWED_DOMAINS: 'acme.ch, Acme.FR' });
  assert.deepEqual(config.allowedDomains, ['acme.ch', 'acme.fr']);
  assert.equal(settings.describe().find((f) => f.key === 'ALLOWED_DOMAINS').effective, 'acme.ch, acme.fr');
  const empty = createSettings({ env: {}, dir: tmp() });
  assert.deepEqual(empty.config.allowedDomains, []);
});

test('lien tel: du support : chiffres seuls, + conservé, poste en ;ext= (RFC 3966)', () => {
  const { telUri } = require('../server/config');
  assert.equal(telUri('+33 1 23 45 67 89'), 'tel:+33123456789');
  assert.equal(telUri('(022) 123 45 67'), 'tel:0221234567');
  assert.equal(telUri('+1 (555) 010-0100'), 'tel:+15550100100');
  assert.equal(telUri('+44 20 7946 0958 ext. 12'), 'tel:+442079460958;ext=12');
  assert.equal(telUri('01 23 45 67 89 poste 204'), 'tel:0123456789;ext=204');
  assert.equal(telUri(''), '');
});

test('la configuration publique donne le lien tel: du support', () => {
  const { createSettings: cs, publicConfigOf } = require('../server/config');
  const { config } = cs({ env: { SUPPORT_PHONE: '+44 20 7946 0958 ext. 12' }, dir: tmp() });
  assert.equal(publicConfigOf(config).support.phoneUri, 'tel:+442079460958;ext=12');
  assert.equal(publicConfigOf(config).support.phone, '+44 20 7946 0958 ext. 12');
});
