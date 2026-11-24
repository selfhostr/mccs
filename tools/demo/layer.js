/* Couche de la démo statique (tools/build-demo.js) : script classique chargé avant les modules de la page.
   mccsServer (modules de server/) et DEMO (constantes du build) sont définis juste avant ce fichier.
   Rien ne quitte le navigateur : fetch() est servi ici pour /api/* et /support/api/*, les réglages et les
   images envoyées restent dans le stockage local de ce navigateur, « Réinitialiser » efface tout. */
/* global mccsServer, DEMO */
(function () {
  'use strict';

  const BASE = DEMO.base;
  const KEY = 'mccs-demo:v1:';
  const FS_KEY = KEY + 'fs';
  const UPLOAD_KEY = KEY + 'upload:';
  const SESSION_KEY = KEY + 'session';
  const DATA = '/data';
  const ADMIN_FILE = DATA + '/demo-admin.json';
  const UPLOAD_LIMIT = 2 * 1024 * 1024;

  /* ---------- Stockage local (absent en navigation privée stricte : repli en mémoire) ---------- */
  function storage(kind) {
    const mem = new Map();
    let s = null;
    try { s = window[kind]; const t = KEY + 't'; s.setItem(t, '1'); s.removeItem(t); } catch { s = null; }
    return {
      get: (k) => { try { return s ? s.getItem(k) : (mem.has(k) ? mem.get(k) : null); } catch { return null; } },
      set: (k, v) => { if (s) s.setItem(k, v); else mem.set(k, v); }, // peut lever QuotaExceededError
      del: (k) => { try { if (s) s.removeItem(k); else mem.delete(k); } catch { /* rien */ } },
      keys: () => { try { return s ? Object.keys(s) : [...mem.keys()]; } catch { return []; } },
    };
  }
  const local = storage('localStorage');
  const session = storage('sessionStorage');

  /* ---------- Faux système de fichiers pour server/store.js : /data/config.json et config.prev.json ---------- */
  function seedFiles() {
    return {
      [DATA + '/config.json']: JSON.stringify({ version: 1, values: DEMO.seed.settings }, null, 2) + '\n',
      [ADMIN_FILE]: JSON.stringify({ password: DEMO.seed.admin.password, setupDone: DEMO.seed.admin.setupDone }),
    };
  }
  function loadFiles() {
    try {
      const f = JSON.parse(local.get(FS_KEY) || 'null');
      if (f && typeof f === 'object' && !Array.isArray(f)) return f;
    } catch { /* repli : marque de départ */ }
    return seedFiles();
  }
  let files = loadFiles();
  const persist = () => local.set(FS_KEY, JSON.stringify(files));
  const enoent = (p) => Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
  const has = (p) => Object.prototype.hasOwnProperty.call(files, p);
  const isDir = (p) => p === DATA;
  const fakeFs = {
    constants: { W_OK: 2 },
    accessSync(p) { if (!isDir(p) && !has(p)) throw enoent(p); },
    statSync(p) {
      if (!isDir(p) && !has(p)) throw enoent(p);
      return { isDirectory: () => isDir(p), isFile: () => !isDir(p) };
    },
    existsSync: (p) => isDir(p) || has(p),
    readFileSync(p) { if (!has(p)) throw enoent(p); return files[p]; },
    writeFileSync(p, data) { files[p] = String(data); persist(); },
    renameSync(a, b) { if (!has(a)) throw enoent(a); files[b] = files[a]; delete files[a]; persist(); },
    unlinkSync(p) { if (!has(p)) throw enoent(p); delete files[p]; persist(); },
    copyFileSync(a, b) { if (!has(a)) throw enoent(a); files[b] = files[a]; persist(); },
  };
  const fakePath = { join: (...p) => p.join('/').replace(/\/{2,}/g, '/') };
  const fakeCrypto = {
    randomUUID() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const x = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
      return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
    },
  };

  // Adresse publique de la démo, d'après l'adresse réelle (liens clients et QR codes).
  const PUBLIC_URL = (location.origin + BASE).replace(/\/+$/, '');
  const require = mccsServer({ fs: fakeFs, path: fakePath, crypto: fakeCrypto }, {
    env: Object.assign({}, DEMO.seed.env, { PUBLIC_URL, DATA_DIR: DATA }),
    pid: 1,
  });
  const { config, settings, publicConfigOf } = require('./config');
  const { validateValues, isHost } = require('./settings');
  const { normalizeEmail, normalizeName } = require('./validate');
  const { buildProfile, parseServices } = require('./mobileconfig');
  const { brandCss } = require('./brand');

  const readAdmin = () => { try { return JSON.parse(fakeFs.readFileSync(ADMIN_FILE)); } catch { return { password: DEMO.seed.admin.password, setupDone: false }; } };
  const writeAdmin = (a) => fakeFs.writeFileSync(ADMIN_FILE, JSON.stringify(a));

  /* ---------- Images envoyées : /uploads/<nom> (valeur de réglage) devient une adresse data: ---------- */
  const UPLOAD_RE = /\/uploads\/((?:logo|background|share)-[0-9a-f]{16}\.(?:png|jpg|webp))/g;
  const uploadUrl = (name) => local.get(UPLOAD_KEY + name) || '';
  // Chemin local d'un réglage (/uploads/…, /img/…) : adresse utilisable sous le préfixe de la démo.
  function asset(v) {
    if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//') || v.startsWith(BASE)) return v;
    const m = /^\/uploads\/([^/?#]+)$/.exec(v);
    if (m) return uploadUrl(m[1]) || 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
    return BASE + v.slice(1);
  }
  const inCss = (v) => (typeof v === 'string' && v.includes('/uploads/') ? v.replace(UPLOAD_RE, (all, name) => uploadUrl(name) || all) : v);
  // Les pages affectent ces chemins à img.src et aux variables CSS : on les traduit au passage.
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true, enumerable: srcDesc.enumerable,
    get() { return srcDesc.get.call(this); },
    set(v) { srcDesc.set.call(this, asset(v)); },
  });
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    return setAttr.call(this, name, this instanceof HTMLImageElement && String(name).toLowerCase() === 'src' ? asset(value) : value);
  };
  const setProp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (name, value, prio) {
    return setProp.call(this, name, inCss(value), prio);
  };

  /* ---------- Marque : la feuille générée par server/brand.js, appliquée en variables sur :root ---------- */
  function applyBrand() {
    const st = document.documentElement.style;
    for (const p of ['--accent', '--accent-on', '--brand-bg']) st.removeProperty(p);
    brandCss(config).replace(/(--[\w-]+):\s*([^;]+);/g, (all, k, v) => { st.setProperty(k, v.trim()); return all; });
  }
  applyBrand();

  /* ---------- Réponses du faux serveur ---------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function bodyJson(init) {
    try { return JSON.parse(typeof init.body === 'string' ? init.body : await new Response(init.body).text()) || {}; } catch { return {}; }
  }
  const loggedIn = () => session.get(SESSION_KEY) === '1';

  function publicConfig() {
    return Object.assign(clone(publicConfigOf(config)), { shots: DEMO.shots });
  }

  // POST /api/test (option « Vérifier le mot de passe ») : simulé, le mot de passe ne quitte pas cette fonction.
  async function connectionTest(init) {
    if (!config.connectionTest) return json(404, { error: 'not_found' });
    const b = await bodyJson(init);
    const email = normalizeEmail(b.email);
    if (!email) return json(422, { error: 'email' });
    const domain = email.split('@')[1];
    if (config.allowedDomains.length && !config.allowedDomains.includes(domain)) return json(403, { error: 'domain' });
    const ok = b.password === 'demo';
    await wait(900);
    return json(200, { imap: { status: ok ? 'ok' : 'auth_failed' }, smtp: { status: ok ? 'ok' : 'skipped' } });
  }

  const DEMO_HOST = /(?:^|\.)example\.(?:com|org|net)$/i;

  async function probe(init) {
    const b = await bodyJson(init);
    const host = typeof b.host === 'string' ? b.host.trim() : '';
    const port = typeof b.port === 'number' || typeof b.port === 'string' ? String(b.port).trim() : '';
    const security = typeof b.security === 'string' ? b.security : '';
    const bad = validateValues({ IMAP_HOST: host, IMAP_PORT: port, IMAP_SECURITY: security });
    const errors = {};
    if (!host || bad.IMAP_HOST) errors.host = bad.IMAP_HOST || 'Nom de serveur manquant.';
    if (!port || bad.IMAP_PORT) errors.port = bad.IMAP_PORT || 'Port manquant.';
    if (!security || bad.IMAP_SECURITY) errors.security = bad.IMAP_SECURITY || 'Choisissez SSL/TLS ou STARTTLS.';
    if (Object.keys(errors).length) return json(422, { ok: false, error: 'invalid', errors });
    await wait(700);
    if (!DEMO_HOST.test(host)) {
      return json(200, { ok: false, error: 'unreachable', detail: 'Démo : aucune connexion ne part du navigateur. Seuls les serveurs en example.com répondent.' });
    }
    const imap = port === '993' || port === '143';
    return json(200, {
      ok: true,
      tls: { authorized: true, subject: host },
      greeting: imap ? `* OK [CAPABILITY IMAP4rev1] ${host} prêt (réponse simulée par la démo)` : `220 ${host} ESMTP prêt (réponse simulée par la démo)`,
    });
  }

  async function discover(init) {
    const b = await bodyJson(init);
    const raw = typeof b.host === 'string' ? b.host.trim() : '';
    let host = raw;
    if (/^https?:\/\//i.test(raw)) { try { host = new URL(raw).hostname; } catch { host = ''; } }
    host = host.toLowerCase().replace(/\.$/, '');
    if (!host || raw.length > 500 || !isHost(host)) {
      const msg = raw ? 'Nom de serveur invalide (ex. mail.example.com ou https://cloud.example.com).' : 'Nom de serveur manquant.';
      return json(422, { ok: false, error: 'invalid', errors: { host: msg } });
    }
    await wait(1100);
    const domain = host.split('.').slice(-2).join('.');
    const note = 'Démo : réponses simulées, aucune requête DNS ni HTTP n’est faite.';
    if (!DEMO_HOST.test(host)) {
      return json(200, { ok: true, caldav: null, carddav: null, server: 'generic', details: [note, 'Seuls les serveurs en example.com répondent dans la démo.'] });
    }
    return json(200, {
      ok: true,
      caldav: { url: `https://${host}/webdav/calendar/`, via: 'dns' },
      carddav: { url: `https://${host}/webdav/addressbook/`, via: 'dns' },
      server: 'mdaemon',
      details: [
        note,
        `DNS : _caldavs._tcp.${domain} désigne https://${host}:443/.well-known/caldav`,
        `https://${host}/.well-known/caldav : redirection vers /webdav/calendar/`,
        `DNS : _carddavs._tcp.${domain} désigne https://${host}:443/.well-known/carddav`,
        `https://${host}/.well-known/carddav : redirection vers /webdav/addressbook/`,
      ],
    });
  }

  const MAGIC = {
    'image/png': { ext: 'png', ok: (b) => b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x) },
    'image/jpeg': { ext: 'jpg', ok: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    'image/webp': { ext: 'webp', ok: (b) => b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP' },
  };
  async function upload(url, init) {
    const kind = url.searchParams.get('kind');
    if (!['logo', 'background', 'share'].includes(kind)) return json(400, { ok: false, error: 'kind' });
    const type = String((init.headers && init.headers['Content-Type']) || '').split(';')[0].trim().toLowerCase();
    const fmt = Object.prototype.hasOwnProperty.call(MAGIC, type) ? MAGIC[type] : null;
    if (!fmt) return json(415, { ok: false, error: 'type' });
    const buf = new Uint8Array(await new Response(init.body).arrayBuffer());
    if (buf.length > UPLOAD_LIMIT) return json(413, { ok: false, error: 'too_large' });
    if (!fmt.ok(buf)) return json(415, { ok: false, error: 'type' });
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(new Blob([buf], { type }));
    });
    const name = `${kind}-${[...crypto.getRandomValues(new Uint8Array(8))].map((n) => n.toString(16).padStart(2, '0')).join('')}.${fmt.ext}`;
    // Une seule image en attente par sorte : les envois précédents qu'aucun réglage n'utilise sont effacés.
    const used = JSON.stringify(files);
    for (const k of local.keys()) {
      if (k.startsWith(UPLOAD_KEY + kind + '-') && !used.includes(k.slice(UPLOAD_KEY.length))) local.del(k);
    }
    try { local.set(UPLOAD_KEY + name, dataUrl); } catch { return json(413, { ok: false, error: 'too_large' }); }
    return json(200, { ok: true, path: '/uploads/' + name });
  }

  async function adminApi(method, route, url, init) {
    if (route === '/login') {
      if (method !== 'POST') return json(405, { ok: false, error: 'method' });
      const b = await bodyJson(init);
      await wait(250);
      if (b.user !== DEMO.seed.admin.user || b.password !== readAdmin().password) return json(401, { error: 'credentials' });
      session.set(SESSION_KEY, '1');
      return json(200, { ok: true });
    }
    if (!loggedIn()) return json(401, { error: 'session' });
    const routes = { '/logout': 'POST', '/state': 'GET', '/settings': 'PUT', '/settings/restore': 'POST', '/setup-done': 'POST', '/upload': 'POST', '/probe': 'POST', '/discover': 'POST', '/password': 'POST' };
    if (!routes[route]) return json(404, { ok: false, error: 'not_found' });
    if (routes[route] !== method) return json(405, { ok: false, error: 'method' });
    switch (route) {
      case '/logout':
        session.del(SESSION_KEY);
        return json(200, { ok: true });
      case '/state':
        return json(200, { brand: config.brand, writable: settings.writable, setupDone: readAdmin().setupDone === true, fields: clone(settings.describe()), passwordFromEnv: false });
      case '/settings': {
        const b = await bodyJson(init);
        const r = settings.save(b.values);
        if (!r.ok) return json(422, { ok: false, errors: r.errors });
        applyBrand();
        return json(200, { ok: true, fields: clone(settings.describe()) });
      }
      case '/settings/restore':
        if (!settings.restorePrevious()) return json(409, { ok: false });
        applyBrand();
        return json(200, { ok: true, fields: clone(settings.describe()) });
      case '/setup-done':
        writeAdmin(Object.assign(readAdmin(), { setupDone: true }));
        return json(200, { ok: true });
      case '/upload':
        return upload(url, init);
      case '/probe':
        return probe(init);
      case '/discover':
        return discover(init);
      case '/password': {
        const b = await bodyJson(init);
        const a = readAdmin();
        if (b.current !== a.password) return json(401, { ok: false, error: 'credentials' });
        const next = typeof b.next === 'string' ? b.next : '';
        if ([...next].length < 12 || next.length > 1024) return json(422, { ok: false, error: 'length' });
        writeAdmin(Object.assign(a, { password: next }));
        return json(200, { ok: true });
      }
    }
    return null;
  }

  // Pendant une redirection, les requêtes de la page restent en attente (pas de message « session expirée »).
  let leaving = false;
  async function route(method, path, url, init) {
    if (leaving) return new Promise(() => {});
    if (path === '/api/config' && method === 'GET') return json(200, publicConfig());
    if (path === '/api/test') return method === 'POST' ? connectionTest(init) : json(405, { error: 'method' });
    if (path.startsWith('/support/api/')) return adminApi(method, path.slice('/support/api'.length), url, init);
    return null;
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input), location.href);
    if (url.origin === location.origin && url.pathname.startsWith(BASE)) {
      const o = Object.assign({}, init || {});
      if (req && o.body === undefined && req.body) o.body = await req.blob();
      const method = String(o.method || (req && req.method) || 'GET').toUpperCase();
      const res = await route(method, '/' + url.pathname.slice(BASE.length), url, o);
      if (res) return res;
    }
    return realFetch(input, init);
  };

  /* ---------- Pages ---------- */
  const here = location.pathname.slice(BASE.length - 1); // « / », « /support/ », « /support/login(.html) »…
  const isLogin = /^\/support\/login(?:\.html)?$/.test(here);
  const isAdmin = /^\/support(?:\/|\/index(?:\.html)?)?$/.test(here);
  const isClient = here === '/' || /^\/index(?:\.html)?$/.test(here);

  // /support exige une session, comme sur le serveur.
  if (isAdmin && !loggedIn()) { leaving = true; location.replace(BASE + 'support/login.html'); }

  // Titre et description de l'accueil (réglages « Référencement »), lus par app.js à son chargement.
  if (isClient) {
    document.title = config.seo.title;
    const d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute('content', config.seo.description);
  }

  function reset() {
    for (const k of local.keys()) if (k.startsWith(KEY)) local.del(k);
    session.del(SESSION_KEY);
    leaving = true;
    location.href = isAdmin || isLogin ? BASE + 'support/login.html' : BASE;
  }

  // Profil Apple : construit ici par server/mobileconfig.js, puis téléchargé (aucune requête).
  function downloadProfile(href) {
    const q = new URL(href, location.href).searchParams;
    const email = normalizeEmail(q.get('email'));
    if (!email) return;
    const body = buildProfile({ email, name: normalizeName(q.get('name') || ''), services: parseServices(q.get('services')), config });
    const filename = (config.brand.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'profile') + '-' + email.replace(/[^A-Za-z0-9._-]+/g, '_') + '.mobileconfig';
    const blobUrl = URL.createObjectURL(new Blob([body], { type: 'application/x-apple-aspen-config' }));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function link(text, href, cls, external) {
    const a = el('a', cls, text);
    a.href = href;
    if (external) a.rel = 'noopener';
    return a;
  }

  function banner() {
    const bar = el('div', 'demo-bar');
    bar.setAttribute('role', 'note');
    bar.setAttribute('aria-label', 'Démo de mccs');
    const inner = el('div', 'demo-bar-in');
    const lead = el('p', 'demo-lead');
    lead.append(el('span', 'demo-tag', 'Démo'), el('span', 'demo-say', `${config.brand === DEMO.seed.settings.BRAND_NAME ? config.brand + ' est une marque fictive. ' : 'Marque fictive. '}`));
    lead.append(el('span', 'demo-say demo-more', 'Tout reste dans ce navigateur, rien n’est envoyé.'));
    const nav = el('p', 'demo-nav');
    if (isAdmin || isLogin) nav.append(link('Site client', BASE, 'demo-link'));
    else nav.append(link('Espace admin', BASE + (loggedIn() ? 'support/' : 'support/login.html'), 'demo-link'));
    const btn = el('button', 'demo-link demo-reset', 'Réinitialiser');
    btn.type = 'button';
    btn.title = 'Efface les réglages et les images de la démo dans ce navigateur';
    btn.addEventListener('click', reset);
    nav.append(btn, link('Installer mccs', DEMO.site + '/download/', 'demo-link demo-out', true));
    inner.append(lead, nav);
    bar.append(inner);
    const skip = document.querySelector('.skip-link');
    if (skip) skip.after(bar); else document.body.prepend(bar);
  }

  // Sous le bouton « Télécharger le profil » : ce que contient le profil de démonstration.
  function noteProfiles(root) {
    for (const box of root.querySelectorAll('.download-box')) {
      if (box.querySelector('.demo-note')) continue;
      box.append(el('p', 'demo-note', 'Démo : le profil est créé dans votre navigateur, avec les serveurs fictifs de la démo. Ouvrez-le pour voir son contenu, ne l’installez pas.'));
    }
  }

  function loginHelp() {
    const form = document.getElementById('login-form');
    if (!form) return;
    const user = document.getElementById('user');
    const pw = document.getElementById('password');
    const a = readAdmin();
    if (user && !user.value) user.value = DEMO.seed.admin.user;
    if (pw && !pw.value) pw.value = a.password;
    const box = el('div', 'demo-cred');
    const p = el('p');
    p.append('Identifiant ', el('code', '', DEMO.seed.admin.user), ', mot de passe ', el('code', '', a.password === DEMO.seed.admin.password ? a.password : 'celui que vous avez choisi'), '. Les champs sont déjà remplis.');
    box.append(el('p', 'demo-cred-title', 'Connexion de démonstration'), p);
    const alert = document.getElementById('login-alert');
    (alert || form.firstChild).before(box);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="profile.mobileconfig"]');
    if (!a) return;
    e.preventDefault();
    downloadProfile(a.getAttribute('href'));
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    if (leaving) return;
    banner();
    if (isLogin) loginHelp();
    if (isClient) {
      new MutationObserver(() => noteProfiles(document)).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
    }
  });
})();
