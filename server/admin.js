'use strict';

// Espace d'administration : connexion par session, API /support/api/*, envoi d'images,
// test des serveurs et mot de passe administrateur (haché scrypt dans <dataDir>/admin.json).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { validateValues, isHost } = require('./settings');
const { probe } = require('./probe');
const { discover: realDiscover } = require('./discover');

const scrypt = util.promisify(crypto.scrypt);

const COOKIE = 'mccs_admin';
const SESSION_S = 8 * 60 * 60;          // 8 h, glissantes
const MAX_SESSIONS = 1000;
const MAX_FAILURES = 10;                // échecs par IP…
const LOCK_MS = 15 * 60 * 1000;         // …sur 15 minutes
const JSON_LIMIT = 64 * 1024;
const UPLOAD_LIMIT = 2 * 1024 * 1024;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 1024;
const ADMIN_VERSION = 1;

// Servis sans session (la page de connexion et ce dont elle a besoin).
const PUBLIC_FILES = new Set(['/support/login.html', '/support/login.js', '/support/support.css']);
const LOGIN_PAGE = '/support/login.html';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const UPLOAD_NAME_RE = /^(logo|background)-[0-9a-f]{16}\.(png|jpg|webp)$/;

// Formats acceptés à l'envoi : type déclaré, extension et octets magiques (le SVG est refusé).
const IMAGES = {
  'image/png': { ext: 'png', magic: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: 'jpg', magic: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: 'webp', magic: (b) => b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' },
};
const EXT_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

// Routes de l'API et méthodes acceptées.
const ROUTES = {
  '/login': ['POST'],
  '/logout': ['POST'],
  '/state': ['GET'],
  '/settings': ['PUT'],
  '/settings/restore': ['POST'],
  '/setup-done': ['POST'],
  '/upload': ['POST'],
  '/probe': ['POST'],
  '/discover': ['POST'],
  '/password': ['POST'],
};

const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();

function defaultSend(req, res, status, body, headers = {}) {
  if (typeof body === 'string') body = Buffer.from(body);
  res.writeHead(status, Object.assign({ 'X-Content-Type-Options': 'nosniff', 'Content-Length': body.length }, headers));
  res.end(req.method === 'HEAD' ? undefined : body);
}

// Écriture atomique (fichier temporaire dans le même dossier, puis rename), comme store.js.
function writeAtomic(file, data, mode) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(tmp, data, { mode });
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* déjà absent */ }
    throw err;
  }
}

class HttpError extends Error {
  constructor(status, error) { super(error); this.status = status; this.error = error; }
}

// Lit le corps en flux et coupe dès que la limite est dépassée (rien n'est gardé au-delà).
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (declared > limit) { reject(new HttpError(413, 'size')); return; }
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) { done = true; chunks.length = 0; reject(new HttpError(413, 'size')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', (err) => { if (!done) { done = true; reject(err); } });
  });
}

async function readJson(req) {
  const body = await readBody(req, JSON_LIMIT);
  if (body.length === 0) return {};
  let data;
  try { data = JSON.parse(body.toString('utf8')); } catch { throw new HttpError(400, 'json'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'json');
  return data;
}

// discover : découverte CalDAV/CardDAV (remplaçable dans les tests).
function createAdmin({ config, settings, dataDir, send = defaultSend, serveStatic = () => false, notFound, discover = realDiscover }) {
  const adminFile = path.join(dataDir, 'admin.json');
  const uploadsDir = path.join(dataDir, 'uploads');
  const sessions = new Map(); // empreinte du jeton -> expiration (ordre = du moins au plus récemment utilisé)
  const failures = new Map(); // ip -> { n, until }
  const nf = notFound || ((req, res, extra) => send(req, res, 404, 'Page introuvable.\n', Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, extra)));

  /* ---------- admin.json ---------- */

  let lastWarning = '';
  function warnOnce(msg) { if (msg !== lastWarning) { lastWarning = msg; console.error(msg); } }

  // { state, password: { salt, hash } | null, setupDone }.
  // Fichier absent (et seulement absent) : mot de passe de l'environnement. Fichier illisible ou d'une
  // version inconnue : connexion bloquée (state 'bad'), jamais de retour silencieux à SUPPORT_PASSWORD.
  function readAdmin() {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return { state: 'missing', password: null, setupDone: false };
      warnOnce(`admin.json illisible (${err.code || err.message}) : connexion bloquée. Corrigez ou supprimez ${adminFile} (la suppression réactive SUPPORT_PASSWORD).`);
      return { state: 'bad', password: null, setupDone: false };
    }
    if (!data || typeof data !== 'object' || data.version !== ADMIN_VERSION) {
      warnOnce(`admin.json de format ou version inconnus : connexion bloquée. Corrigez ou supprimez ${adminFile} (la suppression réactive SUPPORT_PASSWORD).`);
      return { state: 'bad', password: null, setupDone: false };
    }
    const pw = data.password;
    const password = pw && typeof pw.salt === 'string' && typeof pw.hash === 'string' ? { salt: pw.salt, hash: pw.hash } : null;
    return { state: 'ok', password, setupDone: data.setupDone === true };
  }

  function writeAdmin(next) {
    if (readAdmin().state === 'bad') throw new HttpError(503, 'admin-file');
    writeAtomic(adminFile, JSON.stringify({ version: ADMIN_VERSION, password: next.password, setupDone: next.setupDone }, null, 2) + '\n', 0o600);
  }

  function enabled() {
    const a = readAdmin();
    return config.supportAuth.password !== '' || Boolean(a.password) || a.state === 'bad';
  }

  // Comparaison en temps constant : haché scrypt s'il existe, sinon SUPPORT_PASSWORD.
  async function checkPassword(candidate) {
    const pw = typeof candidate === 'string' ? candidate : '';
    const { state, password } = readAdmin();
    if (state === 'bad') throw new HttpError(503, 'admin-file');
    if (password) {
      const expected = Buffer.from(password.hash, 'base64');
      const got = await scrypt(pw, Buffer.from(password.salt, 'base64'), 64);
      return expected.length === got.length && crypto.timingSafeEqual(got, expected);
    }
    if (!config.supportAuth.password) return false;
    return crypto.timingSafeEqual(sha(pw), sha(config.supportAuth.password));
  }

  /* ---------- Verrouillage ---------- */

  // IP du client : en-tête du proxy seulement s'il est déclaré de confiance (TRUSTED_PROXY_HEADER),
  // sinon l'adresse de la connexion. Pour X-Forwarded-For, seule la dernière adresse (ajoutée par le proxy) compte.
  function clientIp(req) {
    const h = config.trustedProxyHeader;
    const raw = h ? req.headers[h] : undefined;
    if (typeof raw === 'string' && raw.trim()) {
      const v = h === 'x-forwarded-for' ? raw.split(',').pop() : raw;
      if (v.trim()) return v.trim();
    }
    return String(req.socket.remoteAddress || '');
  }
  // Secondes restantes de verrouillage (0 = libre).
  function lockedFor(ip) {
    const f = failures.get(ip);
    const now = Date.now();
    return f && f.until > now && f.n >= MAX_FAILURES ? Math.ceil((f.until - now) / 1000) : 0;
  }
  // Compté avant la vérification (essais simultanés compris), effacé en cas de succès.
  // Renvoie le nombre d'essais de la fenêtre : au-delà de MAX_FAILURES, le mot de passe n'est pas vérifié.
  function recordAttempt(ip) {
    const now = Date.now();
    const f = failures.get(ip);
    const cur = f && f.until > now ? f : { n: 0, until: now + LOCK_MS };
    cur.n++;
    failures.set(ip, cur);
    if (failures.size > 5000) {
      for (const [k, v] of failures) if (v.until <= now) failures.delete(k);
      // Encore trop : on retire les plus anciennes entrées (ordre d'insertion), jamais toutes.
      for (const k of failures.keys()) { if (failures.size <= 5000) break; if (k !== ip) failures.delete(k); }
    }
    return cur.n;
  }
  const lockedResponse = (req, res, ip, extra = {}, body = {}) => {
    const wait = Math.max(1, lockedFor(ip));
    return json(req, res, 429, Object.assign(body, { error: 'locked', retryAfter: wait }), Object.assign({ 'Retry-After': String(wait) }, extra));
  };

  /* ---------- Sessions ---------- */

  const keyOf = (token) => sha(token).toString('hex');

  function readToken(req) {
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === COOKIE) {
        const v = part.slice(i + 1).trim();
        return TOKEN_RE.test(v) ? v : null;
      }
    }
    return null;
  }

  function getSession(req) {
    const token = readToken(req);
    if (!token) return null;
    const key = keyOf(token);
    const exp = sessions.get(key);
    if (!exp) return null;
    sessions.delete(key);
    if (exp <= Date.now()) return null;
    sessions.set(key, Date.now() + SESSION_S * 1000);
    return { key, token };
  }

  function createSession() {
    const now = Date.now();
    if (sessions.size >= MAX_SESSIONS) for (const [k, exp] of sessions) if (exp <= now) sessions.delete(k);
    // Au-delà de la limite : la session utilisée le moins récemment est fermée.
    while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(keyOf(token), now + SESSION_S * 1000);
    return token;
  }

  function isHttps(req) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    return proto === 'https' || /^https:/i.test(config.publicUrl) || Boolean(req.socket.encrypted);
  }

  function cookie(req, value, maxAge) {
    return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/support; Max-Age=${maxAge}` + (isHttps(req) ? '; Secure' : '');
  }

  // L'en-tête Origin doit désigner ce serveur : http(s):// + Host, ou l'origine de PUBLIC_URL.
  function originOk(req) {
    const origin = String(req.headers.origin || '').toLowerCase();
    const host = String(req.headers.host || '').toLowerCase();
    if (!origin || origin === 'null') return false;
    if (host && (origin === 'https://' + host || origin === 'http://' + host)) return true;
    try { return origin === new URL(config.publicUrl).origin.toLowerCase(); } catch { return false; }
  }

  /* ---------- Réponses ---------- */

  function json(req, res, status, obj, headers = {}) {
    const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, NOINDEX, headers);
    // Corps non lu (réponse anticipée) : la connexion est fermée plutôt que de lire la suite.
    const hasBody = Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding'] !== undefined;
    if (hasBody && !req.complete) h.Connection = 'close';
    send(req, res, status, JSON.stringify(obj), h);
  }

  /* ---------- Routes de l'API ---------- */

  async function login(req, res) {
    const ip = clientIp(req);
    const wait = lockedFor(ip);
    if (wait) return json(req, res, 429, { error: 'locked', retryAfter: wait }, { 'Retry-After': String(wait) });
    const body = await readJson(req);
    // Revérifié après la lecture du corps : des requêtes simultanées ne dépassent pas la limite.
    if (recordAttempt(ip) > MAX_FAILURES) return lockedResponse(req, res, ip);
    const okUser = crypto.timingSafeEqual(sha(typeof body.user === 'string' ? body.user : ''), sha(config.supportAuth.user));
    const okPass = await checkPassword(body.password);
    if (!okUser || !okPass) return json(req, res, 401, { error: 'credentials' });
    failures.delete(ip);
    json(req, res, 200, { ok: true }, { 'Set-Cookie': cookie(req, createSession(), SESSION_S) });
  }

  function state() {
    const admin = readAdmin();
    return {
      brand: config.brand,
      writable: settings.writable,
      setupDone: admin.setupDone,
      fields: settings.describe(),
      passwordFromEnv: !admin.password,
    };
  }

  async function upload(req, res, url, refresh) {
    const kind = url.searchParams.get('kind');
    if (kind !== 'logo' && kind !== 'background') return json(req, res, 400, { ok: false, error: 'kind' }, refresh);
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const fmt = Object.prototype.hasOwnProperty.call(IMAGES, type) ? IMAGES[type] : null;
    if (!fmt) return json(req, res, 415, { ok: false, error: 'type' }, refresh);
    if (!settings.writable) return json(req, res, 409, { ok: false, error: 'readonly' }, refresh);
    const body = await readBody(req, UPLOAD_LIMIT);
    if (!fmt.magic(body)) return json(req, res, 415, { ok: false, error: 'type' }, refresh);
    const name = `${kind}-${crypto.randomBytes(8).toString('hex')}.${fmt.ext}`;
    fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o700 });
    writeAtomic(path.join(uploadsDir, name), body, 0o600);
    json(req, res, 200, { ok: true, path: '/uploads/' + name }, refresh);
  }

  async function probeRoute(req, res, refresh) {
    const b = await readJson(req);
    const host = typeof b.host === 'string' ? b.host.trim() : '';
    const port = typeof b.port === 'number' || typeof b.port === 'string' ? String(b.port).trim() : '';
    const security = typeof b.security === 'string' ? b.security : '';
    // Mêmes règles que les réglages IMAP_HOST, IMAP_PORT et IMAP_SECURITY.
    const bad = validateValues({ IMAP_HOST: host, IMAP_PORT: port, IMAP_SECURITY: security });
    const errors = {};
    if (!host || bad.IMAP_HOST) errors.host = bad.IMAP_HOST || 'Nom de serveur manquant.';
    if (!port || bad.IMAP_PORT) errors.port = bad.IMAP_PORT || 'Port manquant.';
    if (!security || bad.IMAP_SECURITY) errors.security = bad.IMAP_SECURITY || 'Choisissez SSL/TLS ou STARTTLS.';
    if (Object.keys(errors).length) return json(req, res, 422, { ok: false, error: 'invalid', errors }, refresh);
    json(req, res, 200, await probe({ host, port: Number(port), security }), refresh);
  }

  // Découverte des URL CalDAV/CardDAV : { host } = nom de serveur ou adresse http(s):// (son hôte et son port).
  async function discoverRoute(req, res, refresh) {
    const b = await readJson(req);
    const raw = typeof b.host === 'string' ? b.host.trim() : '';
    let host = raw;
    let port = 443;
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        host = u.hostname;
        if (u.protocol === 'https:' && u.port) port = Number(u.port);
      } catch { host = ''; }
    }
    host = host.toLowerCase().replace(/\.$/, '');
    if (!host || raw.length > 500 || !isHost(host)) {
      const msg = raw ? 'Nom de serveur invalide (ex. mail.example.com ou https://cloud.example.com).' : 'Nom de serveur manquant.';
      return json(req, res, 422, { ok: false, error: 'invalid', errors: { host: msg } }, refresh);
    }
    const r = await discover({ host, port });
    json(req, res, 200, { ok: true, caldav: r.caldav, carddav: r.carddav, server: r.server, details: r.details }, refresh);
  }

  async function password(req, res, session, refresh) {
    const ip = clientIp(req);
    const wait = lockedFor(ip);
    if (wait) return json(req, res, 429, { ok: false, error: 'locked', retryAfter: wait }, Object.assign({ 'Retry-After': String(wait) }, refresh));
    const b = await readJson(req);
    if (recordAttempt(ip) > MAX_FAILURES) return lockedResponse(req, res, ip, refresh, { ok: false });
    if (!(await checkPassword(b.current))) return json(req, res, 401, { ok: false, error: 'credentials' }, refresh);
    failures.delete(ip);
    const next = typeof b.next === 'string' ? b.next : '';
    if ([...next].length < MIN_PASSWORD || next.length > MAX_PASSWORD) return json(req, res, 422, { ok: false, error: 'length' }, refresh);
    if (!settings.writable) return json(req, res, 409, { ok: false, error: 'readonly' }, refresh);
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(next, salt, 64);
    writeAdmin({ password: { salt: salt.toString('base64'), hash: hash.toString('base64') }, setupDone: readAdmin().setupDone });
    // Les autres sessions sont fermées ; celle qui a fait le changement reste ouverte.
    for (const k of [...sessions.keys()]) if (k !== session.key) sessions.delete(k);
    json(req, res, 200, { ok: true }, refresh);
  }

  async function api(req, res, url) {
    const route = url.pathname.slice('/support/api'.length);
    const write = req.method === 'POST' || req.method === 'PUT';
    if (write && !originOk(req)) return json(req, res, 403, { error: 'origin' });
    if (route === '/login') {
      if (req.method !== 'POST') return json(req, res, 405, { ok: false, error: 'method' }, { Allow: 'POST' });
      return login(req, res);
    }
    const session = getSession(req);
    if (!session) return json(req, res, 401, { error: 'session' });
    const methods = Object.prototype.hasOwnProperty.call(ROUTES, route) ? ROUTES[route] : null;
    if (!methods) return json(req, res, 404, { ok: false, error: 'not_found' });
    if (!methods.includes(req.method)) return json(req, res, 405, { ok: false, error: 'method' }, { Allow: methods.join(', ') });

    // Session glissante : le cookie est renouvelé à chaque appel.
    const refresh = { 'Set-Cookie': cookie(req, session.token, SESSION_S) };
    switch (route) {
      case '/logout':
        await readBody(req, JSON_LIMIT);
        sessions.delete(session.key);
        return json(req, res, 200, { ok: true }, { 'Set-Cookie': cookie(req, '', 0) });
      case '/state':
        return json(req, res, 200, state(), refresh);
      case '/settings': {
        const b = await readJson(req);
        const r = settings.save(b.values);
        if (!r.ok) return json(req, res, 422, { ok: false, errors: r.errors }, refresh);
        return json(req, res, 200, { ok: true, fields: settings.describe() }, refresh);
      }
      case '/settings/restore':
        await readBody(req, JSON_LIMIT);
        if (!settings.restorePrevious()) return json(req, res, 409, { ok: false }, refresh);
        return json(req, res, 200, { ok: true, fields: settings.describe() }, refresh);
      case '/setup-done':
        await readBody(req, JSON_LIMIT);
        if (!settings.writable) return json(req, res, 409, { ok: false, error: 'readonly' }, refresh);
        writeAdmin(Object.assign(readAdmin(), { setupDone: true }));
        return json(req, res, 200, { ok: true }, refresh);
      case '/upload':
        return upload(req, res, url, refresh);
      case '/probe':
        return probeRoute(req, res, refresh);
      case '/discover':
        return discoverRoute(req, res, refresh);
      case '/password':
        return password(req, res, session, refresh);
    }
  }

  /* ---------- Fichiers envoyés : /uploads/<nom> ---------- */

  function serveUpload(req, res, p) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(req, res, 405, 'Méthode non autorisée.\n', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    }
    // Seuls les noms générés par l'envoi sont acceptés : aucune traversée possible.
    const m = UPLOAD_NAME_RE.exec(p.slice('/uploads/'.length));
    if (!m) return nf(req, res);
    fs.readFile(path.join(uploadsDir, m[0]), (err, body) => {
      if (err) return nf(req, res);
      send(req, res, 200, body, {
        'Content-Type': EXT_TYPES[m[2]],
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
    });
  }

  /* ---------- Point d'entrée ---------- */

  function handle(req, res, url) {
    const p = url.pathname;
    if (p.startsWith('/uploads/')) { serveUpload(req, res, p); return true; }
    if (p !== '/support' && !p.startsWith('/support/')) return false;

    if (!enabled()) { nf(req, res, NOINDEX); return true; }

    if (p.startsWith('/support/api/')) {
      api(req, res, url).catch((err) => {
        if (res.headersSent) { res.destroy(); return; }
        if (err instanceof HttpError) return json(req, res, err.status, { ok: false, error: err.error });
        console.error('Erreur de l’API d’administration :', err.message);
        json(req, res, 500, { ok: false, error: 'internal' });
      });
      return true;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(req, res, 405, 'Méthode non autorisée.\n', Object.assign({ Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }, NOINDEX));
      return true;
    }
    if (PUBLIC_FILES.has(p)) {
      if (!serveStatic(req, res, p, NOINDEX)) nf(req, res, NOINDEX);
      return true;
    }
    if (!getSession(req)) {
      if (p === '/support' || p === '/support/' || p.endsWith('.html')) {
        send(req, res, 302, '', Object.assign({ Location: LOGIN_PAGE }, NOINDEX));
      } else {
        send(req, res, 401, 'Session requise.\n', Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, NOINDEX));
      }
      return true;
    }
    if (!serveStatic(req, res, p === '/support' || p === '/support/' ? '/support/index.html' : p, NOINDEX)) nf(req, res, NOINDEX);
    return true;
  }

  return { handle, enabled };
}

module.exports = { createAdmin };
