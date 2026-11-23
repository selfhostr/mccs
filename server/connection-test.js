'use strict';

// POST /api/test { email, password } : le client vérifie son adresse et son mot de passe avant de
// configurer son appareil. Option de l'admin (CONNECTION_TEST), désactivée par défaut (404).
//
// - Connexion uniquement aux serveurs IMAP et SMTP configurés, jamais à un hôte venu du client.
// - Limites par adresse e-mail puis par IP (fenêtre de 15 minutes), comptées avant toute connexion,
//   de façon synchrone : des requêtes simultanées ne dépassent pas la limite.
// - Le mot de passe n'est jamais journalisé, renvoyé ni stocké : il passe dans un Buffer remis à zéro
//   après le test, et le corps brut de la requête est effacé dès qu'il est analysé.
const { normalizeEmail } = require('./validate');
const { testAccount } = require('./mailauth');
const { HttpError, readJson, clientIp, originOk, createWindowCounter } = require('./http-util');

const BODY_LIMIT = 8 * 1024;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PASSWORD = 1024;
const MAX_CONCURRENT = 50;          // tests en cours sur toute l'instance
const TIMEOUT_MS = 8000;            // par service
const PATH = '/api/test';

function defaultSend(req, res, status, body, headers = {}) {
  const b = Buffer.from(body);
  res.writeHead(status, Object.assign({ 'X-Content-Type-Options': 'nosniff', 'Content-Length': b.length }, headers));
  res.end(req.method === 'HEAD' ? undefined : b);
}

// Mot de passe acceptable : texte de 1 à 1024 caractères, sans NUL ni retour à la ligne
// (ils casseraient les protocoles IMAP et SMTP ; aucun vrai mot de passe n'en contient).
const validPassword = (p) => typeof p === 'string' && p.length >= 1 && p.length <= MAX_PASSWORD && !/[\u0000\r\n]/.test(p);

/**
 * createConnectionTest({ config, send, notFound, ca, timeoutMs, test, maxConcurrent })
 * ca, timeoutMs, test (fonction de test remplaçable) et maxConcurrent servent aux tests automatisés.
 */
function createConnectionTest({ config, send = defaultSend, notFound, ca, timeoutMs = TIMEOUT_MS, test = testAccount, maxConcurrent = MAX_CONCURRENT }) {
  const byEmail = createWindowCounter({ windowMs: WINDOW_MS });
  const byIp = createWindowCounter({ windowMs: WINDOW_MS });
  let running = 0;

  function json(req, res, status, obj, headers = {}) {
    const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers);
    // Corps non lu (réponse anticipée) : la connexion est fermée plutôt que de lire la suite.
    const hasBody = Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding'] !== undefined;
    if (hasBody && !req.complete) h.Connection = 'close';
    send(req, res, status, JSON.stringify(obj), h);
  }

  async function run(req, res) {
    if (req.method !== 'POST') return json(req, res, 405, { error: 'method' }, { Allow: 'POST' });
    if (!originOk(req, config.publicUrl)) return json(req, res, 403, { error: 'origin' });
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') return json(req, res, 415, { error: 'type' });

    const body = await readJson(req, BODY_LIMIT, { wipe: true });
    let raw = body.password;
    body.password = undefined;
    const email = normalizeEmail(body.email);
    if (!email) return json(req, res, 422, { error: 'email' });
    if (!validPassword(raw)) return json(req, res, 422, { error: 'password' });

    const domain = email.slice(email.lastIndexOf('@') + 1);
    if (config.allowedDomains.length && !config.allowedDomains.includes(domain)) return json(req, res, 403, { error: 'domain' });

    // Limites : vérifiées puis comptées sans attente entre les deux (aucune course possible).
    const ip = clientIp(req, config.trustedProxyHeader);
    const key = email.toLowerCase();
    const { perEmail, perIp } = config.connectionTestLimits;
    const over = byEmail.count(key) >= perEmail ? byEmail : byIp.count(ip) >= perIp ? byIp : null;
    if (over) {
      const wait = over.retryAfter(over === byEmail ? key : ip);
      return json(req, res, 429, { error: 'rate_limited', retryAfter: wait }, { 'Retry-After': String(wait) });
    }
    if (running >= maxConcurrent) return json(req, res, 503, { error: 'busy' }, { 'Retry-After': '5' });
    byEmail.hit(key);
    byIp.hit(ip);

    const password = Buffer.from(raw, 'utf8');
    raw = null;
    running++;
    try {
      const result = await test({
        user: email,
        password,
        imap: { host: config.imap.host, port: config.imap.port, security: config.imap.security },
        smtp: { host: config.smtp.host, port: config.smtp.port, security: config.smtp.security },
        timeoutMs,
        ca,
      });
      return json(req, res, 200, { imap: { status: result.imap.status }, smtp: { status: result.smtp.status } });
    } finally {
      running--;
      password.fill(0);
    }
  }

  function handle(req, res, url) {
    if (url.pathname !== PATH) return false;
    // Option désactivée : la route n'existe pas (404), rien n'est lu.
    if (!config.connectionTest) {
      if (notFound) notFound(req, res, { 'Cache-Control': 'no-store' }); else json(req, res, 404, { error: 'not_found' });
      return true;
    }
    run(req, res).catch((err) => {
      if (res.headersSent) { res.destroy(); return; }
      if (err instanceof HttpError) return json(req, res, err.status, { error: err.error });
      // Jamais le message d'erreur : il pourrait contenir une donnée de la requête.
      console.error('Test de connexion : erreur interne' + (err && err.code ? ` (${err.code})` : '') + '.');
      json(req, res, 500, { error: 'internal' });
    });
    return true;
  }

  return { handle };
}

module.exports = { createConnectionTest };
