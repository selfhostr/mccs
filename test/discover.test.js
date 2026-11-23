'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { discover } = require('../server/discover');
const { davServer, cert, redirect, multistatus, unauthorized, notFound } = require('./helpers/dav-server');

// Sans DNS : aucun enregistrement SRV (les tests SRV fournissent les leurs).
const noSrv = async () => { const e = new Error('absent'); e.code = 'ENOTFOUND'; throw e; };
const noTxt = noSrv;
const run = (s, opts = {}) => discover(Object.assign({ host: 'localhost', port: s.port, ca: cert, resolveSrv: noSrv, resolveTxt: noTxt, timeoutMs: 3000 }, opts));
const base = (s) => `https://localhost:${s.port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Serveur « standard » : /.well-known/* -> /dav/, PROPFIND /dav/ -> 207.
const standard = (req, res) => {
  if (req.url === '/.well-known/caldav' || req.url === '/.well-known/carddav') return redirect(res, '/dav/');
  if (req.url === '/dav/' && req.method === 'PROPFIND') return multistatus(res);
  notFound(res);
};

test('.well-known : redirection suivie, PROPFIND 207 -> URL de contexte retenue', async () => {
  const s = await davServer(standard);
  try {
    const r = await run(s);
    assert.deepEqual(r.caldav, { url: base(s) + '/dav/', via: 'well-known' });
    assert.deepEqual(r.carddav, { url: base(s) + '/dav/', via: 'well-known' });
    assert.equal(r.server, 'generic');
    assert.ok(Array.isArray(r.details) && r.details.length > 0);
    assert.ok(s.requests.includes('PROPFIND /.well-known/caldav'), s.requests.join(', '));
  } finally { await s.close(); }
});

test('PROPFIND envoyé avec Depth: 0 et un corps current-user-principal', async () => {
  let seen = null;
  const s = await davServer((req, res) => {
    if (req.method !== 'PROPFIND') return notFound(res);
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => { seen = seen || { depth: req.headers.depth, body }; multistatus(res); });
  });
  try {
    await run(s);
    assert.equal(seen.depth, '0');
    assert.match(seen.body, /current-user-principal/);
  } finally { await s.close(); }
});

test('redirection vers une ressource protégée (401) : service retenu', async () => {
  const s = await davServer((req, res) => {
    if (req.url === '/.well-known/caldav') return redirect(res, base(s) + '/dav/calendars');
    if (req.url === '/.well-known/carddav') return redirect(res, base(s) + '/dav/addressbooks');
    unauthorized(res);
  });
  try {
    const r = await run(s);
    assert.deepEqual(r.caldav, { url: base(s) + '/dav/calendars', via: 'well-known' });
    assert.deepEqual(r.carddav, { url: base(s) + '/dav/addressbooks', via: 'well-known' });
  } finally { await s.close(); }
});

test('401 direct sans en-tête DAV : pas une preuve ; avec « DAV: calendar-access » : retenu', async () => {
  const s = await davServer((req, res) => {
    if (req.url === '/.well-known/caldav') return unauthorized(res, { DAV: '1, 2, access-control, calendar-access' });
    unauthorized(res);
  });
  try {
    const r = await run(s);
    assert.deepEqual(r.caldav, { url: base(s) + '/.well-known/caldav', via: 'well-known' });
    assert.equal(r.carddav, null);
  } finally { await s.close(); }
});

test('OPTIONS : en-tête DAV « addressbook » accepté quand PROPFIND est refusé', async () => {
  const s = await davServer((req, res) => {
    if (req.url === '/.well-known/carddav' && req.method === 'OPTIONS') { res.writeHead(200, { DAV: '1, 3, addressbook' }); return res.end(); }
    res.writeHead(405); res.end();
  });
  try {
    const r = await run(s);
    assert.deepEqual(r.carddav, { url: base(s) + '/.well-known/carddav', via: 'well-known' });
    assert.equal(r.caldav, null);
  } finally { await s.close(); }
});

test('une page HTML ordinaire n’est pas prise pour un service DAV', async () => {
  const s = await davServer((req, res) => {
    if (req.url.startsWith('/.well-known/')) return redirect(res, '/');
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<h1>Bienvenue</h1>');
  });
  try {
    const r = await run(s);
    assert.equal(r.caldav, null);
    assert.equal(r.carddav, null);
  } finally { await s.close(); }
});

test('boucle de redirection : abandon, sans requêtes en boucle', async () => {
  const s = await davServer((req, res) => redirect(res, req.url === '/a' ? '/b' : '/a'));
  try {
    const r = await run(s);
    assert.equal(r.caldav, null);
    assert.ok(s.requests.length <= 14, String(s.requests.length));
    assert.ok(r.details.some((d) => /boucle/i.test(d)), r.details.join('\n'));
  } finally { await s.close(); }
});

test('plus de 5 redirections : abandon', async () => {
  const s = await davServer((req, res) => {
    const n = Number((/^\/r(\d+)$/.exec(req.url) || [0, 0])[1]);
    redirect(res, '/r' + (n + 1));
  });
  try {
    const r = await run(s);
    assert.equal(r.caldav, null);
    // Requête initiale + 5 redirections suivies, pour chacun des deux services.
    assert.ok(s.requests.filter((q) => q.startsWith('PROPFIND')).length <= 12, s.requests.join(', '));
    assert.ok(r.details.some((d) => /redirections/i.test(d)), r.details.join('\n'));
  } finally { await s.close(); }
});

test('redirection vers http:// refusée', async () => {
  const s = await davServer((req, res) => redirect(res, 'http://localhost:1/dav/'));
  try {
    const r = await run(s);
    assert.equal(r.caldav, null);
    assert.equal(r.carddav, null);
  } finally { await s.close(); }
});

test('serveur muet : le délai est tenu et les sockets sont libérées', async () => {
  const s = await davServer(() => { /* jamais de réponse */ });
  try {
    const t0 = Date.now();
    const r = await run(s, { timeoutMs: 400 });
    assert.ok(Date.now() - t0 < 1500, String(Date.now() - t0));
    assert.equal(r.caldav, null);
    assert.ok(r.details.some((d) => /délai|réponse/i.test(d)), r.details.join('\n'));
    await wait(100);
    assert.equal(s.sockets.size, 0);
  } finally { await s.close(); }
});

test('réponse énorme : lue partiellement puis coupée', async () => {
  let open = 0;
  const s = await davServer((req, res) => {
    if (req.url.startsWith('/.well-known/')) {
      res.writeHead(207, { 'Content-Type': 'application/xml' });
      open++;
      const chunk = Buffer.alloc(64 * 1024, 'x');
      const pump = () => { while (res.write(chunk)) { /* remplit le tampon */ } };
      res.on('drain', pump);
      res.on('close', () => { open--; });
      return pump();
    }
    notFound(res);
  });
  try {
    const t0 = Date.now();
    const r = await run(s);
    assert.ok(Date.now() - t0 < 2500, String(Date.now() - t0));
    assert.deepEqual(r.caldav, { url: base(s) + '/.well-known/caldav', via: 'well-known' });
    await wait(200);
    assert.equal(open, 0);
  } finally { await s.close(); }
});

test('en-têtes démesurés : échec propre', async () => {
  const s = await davServer((req, res) => { res.writeHead(207, { 'X-Big': 'x'.repeat(40000) }); res.end(); });
  try {
    const r = await run(s);
    assert.equal(r.caldav, null);
  } finally { await s.close(); }
});

test('certificat non reconnu : refusé (vérification TLS stricte)', async () => {
  const s = await davServer(standard);
  try {
    const r = await run(s, { ca: undefined });
    assert.equal(r.caldav, null);
    assert.ok(r.details.some((d) => /certificat/i.test(d)), r.details.join('\n'));
  } finally { await s.close(); }
});

test('MDaemon reconnu à son en-tête Server', async () => {
  const s = await davServer((req, res) => {
    if (req.url.startsWith('/.well-known/')) return redirect(res, '/dav/');
    unauthorized(res, { Server: 'MDaemon Webmail 24.0' });
  });
  try {
    const r = await run(s);
    assert.equal(r.server, 'mdaemon');
  } finally { await s.close(); }
});

test('MDaemon reconnu à ses chemins /webdav/', async () => {
  const s = await davServer((req, res) => {
    if (req.url === '/.well-known/caldav') return redirect(res, '/webdav/calendar');
    if (req.url === '/.well-known/carddav') return redirect(res, '/webdav/addressbook');
    unauthorized(res);
  });
  try {
    const r = await run(s);
    assert.equal(r.server, 'mdaemon');
    assert.equal(r.caldav.url, base(s) + '/webdav/calendar');
  } finally { await s.close(); }
});

/* ---------- DNS (SRV + TXT) ---------- */

function fakeDns(records) {
  const asked = [];
  return {
    asked,
    resolveSrv: async (name) => { asked.push('SRV ' + name); if (records.srv[name]) return records.srv[name]; return noSrv(); },
    resolveTxt: async (name) => { asked.push('TXT ' + name); if (records.txt && records.txt[name]) return records.txt[name]; return noTxt(); },
  };
}

test('SRV + TXT path= : URL donnée par le DNS, essai du domaine avant l’hôte', async () => {
  const s = await davServer((req, res) => {
    if (req.url === '/cal/' || req.url === '/card/') return multistatus(res);
    notFound(res);
  });
  try {
    const dns = fakeDns({
      srv: {
        '_caldavs._tcp.example.test': [{ name: 'localhost', port: s.port, priority: 0, weight: 0 }],
        '_carddavs._tcp.mail.example.test': [{ name: 'localhost', port: s.port, priority: 0, weight: 0 }],
      },
      txt: { '_caldavs._tcp.example.test': [['path=/cal/']], '_carddavs._tcp.mail.example.test': [['path=/card/']] },
    });
    const r = await run(s, { host: 'mail.example.test', port: undefined, resolveSrv: dns.resolveSrv, resolveTxt: dns.resolveTxt });
    assert.deepEqual(r.caldav, { url: base(s) + '/cal/', via: 'dns' });
    assert.deepEqual(r.carddav, { url: base(s) + '/card/', via: 'dns' });
    assert.ok(dns.asked.indexOf('SRV _carddavs._tcp.example.test') < dns.asked.indexOf('SRV _carddavs._tcp.mail.example.test'), dns.asked.join(', '));
  } finally { await s.close(); }
});

test('SRV sans TXT : /.well-known sur la cible, redirections suivies', async () => {
  const s = await davServer(standard);
  try {
    const srv = [{ name: 'localhost', port: s.port, priority: 0, weight: 0 }];
    const dns = fakeDns({ srv: { '_caldavs._tcp.example.test': srv, '_carddavs._tcp.example.test': srv } });
    const r = await run(s, { host: 'example.test', port: undefined, resolveSrv: dns.resolveSrv, resolveTxt: dns.resolveTxt });
    assert.deepEqual(r.caldav, { url: base(s) + '/dav/', via: 'dns' });
  } finally { await s.close(); }
});

test('SRV cible « . » (service absent) ou priorité : la bonne cible est choisie', async () => {
  const s = await davServer(standard);
  try {
    const dns = fakeDns({
      srv: {
        '_caldavs._tcp.example.test': [{ name: 'nowhere.invalid', port: 1, priority: 20, weight: 0 }, { name: 'localhost', port: s.port, priority: 10, weight: 0 }],
        '_carddavs._tcp.example.test': [{ name: '.', port: 0, priority: 0, weight: 0 }],
      },
    });
    const r = await run(s, { host: 'localhost', resolveSrv: dns.resolveSrv, resolveTxt: dns.resolveTxt, domains: ['example.test'] });
    assert.deepEqual(r.caldav, { url: base(s) + '/dav/', via: 'dns' });
    // Contacts : SRV « . » ignoré, repli sur /.well-known de l'hôte.
    assert.deepEqual(r.carddav, { url: base(s) + '/dav/', via: 'well-known' });
  } finally { await s.close(); }
});

test('en-têtes envoyés en ASCII (certains serveurs répondent 400 sinon)', async () => {
  const raw = [];
  const s = await davServer((req, res) => { raw.push(req.rawHeaders.join('\n')); multistatus(res); });
  try {
    await run(s);
    assert.ok(raw.length > 0);
    for (const h of raw) assert.match(h, /^[\x20-\x7e\n]*$/, h);
  } finally { await s.close(); }
});
