'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { config, settings, publicConfig, DATA_DIR } = require('./config');
const { normalizeEmail, normalizeName } = require('./validate');
const { buildProfile, parseServices } = require('./mobileconfig');
const { buildAutoconfig } = require('./autoconfig');
const { createAdmin } = require('./admin');
const { createConnectionTest } = require('./connection-test');
const { renderHead, injectHead, robotsTxt, sitemapXml } = require('./seo');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// CSP : recalculée à chaque changement de réglages (logo externe : seule son origine est ajoutée à img-src).
// L'image de partage externe (SEO_IMAGE) n'est affichée que dans l'aperçu de l'admin.
function buildCsp() {
  const origins = [...new Set([config.brandLogoUrl, config.seo.image].filter((u) => /^https?:\/\//.test(u)).map((u) => new URL(u).origin))];
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:" + origins.map((o) => ' ' + o).join(''),
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': '',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000',
};

// Fichiers statiques chargés en mémoire au démarrage (avec version gzip pour le texte).
const files = new Map();
(function load(dir, prefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const url = prefix + '/' + entry.name;
    if (entry.isDirectory()) { load(full, url); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    if (!TYPES[ext]) continue;
    const body = fs.readFileSync(full);
    const text = /^(text|application\/(json|manifest)|image\/svg)/.test(TYPES[ext]);
    files.set(url, { body, gz: text ? zlib.gzipSync(body, { level: 9 }) : null, type: TYPES[ext], ext });
  }
})(PUBLIC_DIR, '');

// Cache-busting : un hash du contenu de tous les CSS/JS est injecté (?v=…) dans les URL des assets
// du HTML et dans les imports des modules JS. Les URL versionnées sont servies en immutable.
const BUILD = (() => {
  const h = crypto.createHash('sha256');
  for (const u of [...files.keys()].sort()) if (/\.(css|js)$/.test(u)) h.update(u).update(files.get(u).body);
  return h.digest('hex').slice(0, 10);
})();
const withV = (u) => u + '?v=' + BUILD;
for (const [u, f] of files) {
  let txt;
  if (f.ext === '.html') {
    // /brand.css change avec les réglages : versionné par son propre contenu dans refresh().
    txt = f.body.toString('utf8').replace(/((?:href|src)=")(\/[^"?#]+\.(?:css|js))(")/g, (m, a, b, c) => (b === '/brand.css' ? m : a + withV(b) + c));
  } else if (f.ext === '.js') {
    txt = f.body.toString('utf8').replace(/(\bfrom\s*')([^'?]+\.js)(')/g, (m, a, b, c) => a + withV(b) + c);
  } else continue;
  f.body = Buffer.from(txt);
  f.gz = zlib.gzipSync(f.body, { level: 9 });
}

// Captures d'écran des guides réellement présentes (public/img/guides/…) : le front n'affiche
// le lien « Voir une capture » que pour celles-ci.
const GUIDE_SHOTS = [...files.keys()]
  .filter((u) => u.startsWith('/img/guides/') && /\.(png|jpe?g|webp)$/i.test(u))
  .map((u) => u.slice('/img/guides/'.length))
  .sort();
// Feuille de marque générée (accent, fond de page) : fichier séparé plutôt qu'un style inline,
// pour respecter la CSP (style-src 'self').
function brandCss() {
  const rules = [];
  if (config.brandAccent) rules.push(`--accent: ${config.brandAccent};`, '--accent-on: #ffffff;');
  const bg = config.brandBackground;
  if (/^#[0-9a-f]+,#[0-9a-f]+$/i.test(bg)) { const [a, b] = bg.split(','); rules.push(`--brand-bg: linear-gradient(160deg, ${a}, ${b});`); }
  else if (bg.startsWith('#')) rules.push(`--brand-bg: ${bg};`);
  else if (bg.startsWith('/uploads/')) rules.push(`--brand-bg: center / cover no-repeat url("${bg}"), var(--bg);`);
  return `:root { ${rules.join(' ')} }\n`;
}

// Page d'accueil telle que chargée (assets versionnés), avant l'insertion du <head> de référencement.
const INDEX_TEMPLATE = files.get('/index.html').body.toString('utf8');
// Pages qui chargent /brand.css : leur lien porte un hash du contenu (?v=…), recalculé à chaque
// enregistrement, pour qu'un proxy ou un CDN qui garde les .css malgré no-cache serve la nouvelle version.
const BRAND_PAGES = new Map([...files].filter(([, f]) => f.ext === '.html' && f.body.includes('href="/brand.css"')).map(([u, f]) => [u, f.body.toString('utf8')]));
const BRAND_HREF = /href="\/brand\.css"/g;

// Tout ce qui dépend des réglages, recalculé au démarrage et après chaque enregistrement.
let configJson;
let robots;
let sitemap;
const live = (text, ext) => {
  const body = Buffer.from(text);
  return { body, gz: zlib.gzipSync(body, { level: 9 }), type: TYPES[ext], ext, live: true };
};
function refresh() {
  SECURITY_HEADERS['Content-Security-Policy'] = buildCsp();
  configJson = Buffer.from(JSON.stringify(Object.assign(publicConfig(), { shots: GUIDE_SHOTS })));
  const css = brandCss();
  files.set('/brand.css', live(css, '.css'));
  const href = 'href="/brand.css?v=' + crypto.createHash('sha256').update(css).digest('hex').slice(0, 10) + '"';
  for (const [u, html] of BRAND_PAGES) {
    const page = u === '/index.html' ? injectHead(INDEX_TEMPLATE, renderHead(config)) : html;
    files.set(u, live(page.replace(BRAND_HREF, href), '.html'));
  }
  robots = Buffer.from(robotsTxt(config));
  const xml = sitemapXml(config);
  sitemap = xml === null ? null : Buffer.from(xml);
}
refresh();
settings.onChange(refresh);

function notFound(req, res, extra = {}) {
  const nf = files.get('/404.html');
  return send(req, res, 404, nf ? nf.body : 'Page introuvable.\n', Object.assign({
    'Content-Type': nf ? nf.type : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  }, extra));
}

function send(req, res, status, body, headers = {}) {
  const h = Object.assign({}, SECURITY_HEADERS, headers);
  if (typeof body === 'string') body = Buffer.from(body);
  h['Content-Length'] = body.length;
  res.writeHead(status, h);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function sendText(req, res, status, text) {
  send(req, res, status, text + '\n', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
}

function serveStatic(req, res, pathname, extra = {}) {
  if (pathname === '/') pathname = '/index.html';
  const f = files.get(pathname);
  if (!f) return false;
  const versioned = new URL(req.url, 'http://localhost').searchParams.get('v') === BUILD;
  const headers = Object.assign({
    'Content-Type': f.type,
    'Cache-Control': f.ext === '.html' || f.live ? 'no-cache' : versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
    Vary: 'Accept-Encoding',
  }, extra);
  let body = f.body;
  if (f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    body = f.gz;
    headers['Content-Encoding'] = 'gzip';
  }
  send(req, res, 200, body, headers);
  return true;
}

function handleProfile(req, res, q) {
  const email = normalizeEmail(q.get('email'));
  if (!email) return sendText(req, res, 400, 'Adresse e-mail invalide.');
  const name = normalizeName(q.get('name') || '');
  const services = parseServices(q.get('services'));
  const body = buildProfile({ email, name, services, config });
  const filename = (config.brand.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'profile') + '-' +
    email.replace(/[^A-Za-z0-9._-]+/g, '_') + '.mobileconfig';
  send(req, res, 200, body, {
    'Content-Type': 'application/x-apple-aspen-config',
    'Content-Disposition': 'attachment; filename="' + filename + '"',
    'Cache-Control': 'no-store',
  });
}

function handleAutoconfig(req, res, q) {
  const raw = q.get('emailaddress');
  let domain;
  if (raw) {
    const email = normalizeEmail(raw);
    if (!email) return sendText(req, res, 400, 'Adresse e-mail invalide.');
    domain = email.split('@')[1];
  } else {
    // Requête Thunderbird classique : autoconfig.<domaine>/mail/config-v1.1.xml
    const host = String(req.headers.host || '').split(':')[0].toLowerCase().replace(/^autoconfig\./, '');
    domain = normalizeEmail('x@' + host) ? host : config.imap.host;
  }
  send(req, res, 200, buildAutoconfig({ domain, config }), {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'no-store',
  });
}

// Espace d'administration (/support, /support/api/*) et fichiers envoyés (/uploads/*).
const admin = createAdmin({ config, settings, dataDir: DATA_DIR, send, serveStatic, notFound });
// Vérification du mot de passe par le client (POST /api/test), si l'option est activée.
const connectionTest = createConnectionTest({ config, send, notFound });

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return sendText(req, res, 400, 'Requête invalide.');
  }
  const p = url.pathname;
  try {
    // POST et PUT ne sont acceptés que sur /support/api/* (vérifié dans admin.js) et POST sur /api/test.
    if (admin.handle(req, res, url)) return;
    if (connectionTest.handle(req, res, url)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(req, res, 405, 'Méthode non autorisée.\n', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    }
    if (p === '/healthz') return sendText(req, res, 200, 'ok');
    if (p === '/api/config') {
      return send(req, res, 200, configJson, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    if (p === '/robots.txt') {
      return send(req, res, 200, robots, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    if (p === '/sitemap.xml') {
      if (!sitemap) return notFound(req, res);
      return send(req, res, 200, sitemap, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    if (p === '/profile.mobileconfig') return handleProfile(req, res, url.searchParams);
    if (p === '/mail/config-v1.1.xml' || p === '/.well-known/autoconfig/mail/config-v1.1.xml') {
      return handleAutoconfig(req, res, url.searchParams);
    }
    if (serveStatic(req, res, p)) return;
    return notFound(req, res);
  } catch (err) {
    console.error(err);
    return sendText(req, res, 500, 'Erreur interne.');
  }
});

server.keepAliveTimeout = 65000;
// Importé (tests, outils) : pas d'écoute automatique.
module.exports = { server, settings, start };
function start() {
  let initial = null;
  try { initial = admin.firstRun(); } catch (err) { console.error(`Mot de passe de première connexion impossible à créer : ${err.message}`); }
  server.listen(config.port, '0.0.0.0', () => {
    if (initial) {
      console.log([
        '',
        '  Première connexion à mccs',
        '  Ouvrez       http://<adresse-du-serveur>:<port publié, 8080 par défaut>/support',
        `  Identifiant  ${config.supportAuth.user}`,
        `  Mot de passe ${initial.password}`,
        '  Changez-le ensuite (menu du compte > Changer le mot de passe) : ce message disparaîtra.',
        '',
      ].join('\n'));
    }
    if (!settings.writable) {
      console.error([
        '',
        `  ${DATA_DIR} n'est pas accessible en écriture (utilisateur ${process.getuid ? process.getuid() : '?'}) : réglages en lecture seule${admin.enabled() ? '' : ' et page /support désactivée'}.`,
        `  Si ${DATA_DIR} est un dossier de l'hôte : sudo chown -R 1000:1000 <ce dossier>, puis docker compose restart mccs.`,
        '',
      ].join('\n'));
    }
    console.log(`mccs à l'écoute sur :${config.port} (${files.size} fichiers statiques, ${GUIDE_SHOTS.length} captures, page /support ${admin.enabled() ? 'active' : 'désactivée'}, réglages ${settings.writable ? 'dans ' + DATA_DIR : 'en lecture seule'})`);
  });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
if (require.main === module) start();
