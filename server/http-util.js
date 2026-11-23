'use strict';

// Outils HTTP partagés par l'espace d'administration et le test de connexion : lecture bornée du corps,
// IP du client (proxy de confiance), contrôle de l'en-tête Origin et compteurs d'essais par fenêtre.

class HttpError extends Error {
  constructor(status, error) { super(error); this.status = status; this.error = error; }
}

// Lit le corps en flux et coupe dès que la limite est dépassée (rien n'est gardé au-delà).
// wipe : les morceaux reçus sont remis à zéro après usage (corps contenant un mot de passe) ;
// l'appelant remet à zéro le tampon renvoyé.
function readBody(req, limit, { wipe = false } = {}) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (declared > limit) { reject(new HttpError(413, 'size')); return; }
    const chunks = [];
    let size = 0;
    let done = false;
    const clear = () => { if (wipe) for (const c of chunks) c.fill(0); chunks.length = 0; };
    req.on('data', (chunk) => {
      if (done) { if (wipe) chunk.fill(0); return; }
      size += chunk.length;
      if (size > limit) { done = true; if (wipe) chunk.fill(0); clear(); reject(new HttpError(413, 'size')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      const body = Buffer.concat(chunks);
      clear();
      resolve(body);
    });
    req.on('error', (err) => { if (!done) { done = true; clear(); reject(err); } });
  });
}

// Corps JSON (objet) ; {} si vide. wipe : le texte brut est effacé après l'analyse.
async function readJson(req, limit, opts = {}) {
  const body = await readBody(req, limit, opts);
  if (body.length === 0) return {};
  let data;
  try { data = JSON.parse(body.toString('utf8')); } catch { data = undefined; }
  if (opts.wipe) body.fill(0);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'json');
  return data;
}

// IP du client : en-tête du proxy seulement s'il est déclaré de confiance (TRUSTED_PROXY_HEADER, en minuscules),
// sinon l'adresse de la connexion. Pour X-Forwarded-For, seule la dernière adresse (ajoutée par le proxy) compte.
function clientIp(req, trustedHeader) {
  const h = trustedHeader;
  const raw = h ? req.headers[h] : undefined;
  if (typeof raw === 'string' && raw.trim()) {
    const v = h === 'x-forwarded-for' ? raw.split(',').pop() : raw;
    if (v.trim()) return v.trim();
  }
  return String(req.socket.remoteAddress || '');
}

// L'en-tête Origin doit désigner ce serveur : http(s):// + Host, ou l'origine de PUBLIC_URL.
function originOk(req, publicUrl) {
  const origin = String(req.headers.origin || '').toLowerCase();
  const host = String(req.headers.host || '').toLowerCase();
  if (!origin || origin === 'null') return false;
  if (host && (origin === 'https://' + host || origin === 'http://' + host)) return true;
  try { return origin === new URL(publicUrl).origin.toLowerCase(); } catch { return false; }
}

// Compteur d'essais par clé sur une fenêtre fixe (la fenêtre démarre au premier essai).
// Tout est synchrone : des requêtes simultanées sont comptées une à une, sans course possible.
function createWindowCounter({ windowMs, maxEntries = 5000 }) {
  const entries = new Map(); // clé -> { n, until }
  const live = (key, now) => { const e = entries.get(key); return e && e.until > now ? e : null; };
  return {
    // Nombre d'essais de la fenêtre en cours (0 si elle est terminée).
    count(key) { const e = live(key, Date.now()); return e ? e.n : 0; },
    // Ajoute un essai et renvoie le total de la fenêtre.
    hit(key) {
      const now = Date.now();
      const cur = live(key, now) || { n: 0, until: now + windowMs };
      cur.n++;
      entries.set(key, cur);
      if (entries.size > maxEntries) {
        for (const [k, v] of entries) if (v.until <= now) entries.delete(k);
        // Encore trop : on retire les plus anciennes entrées (ordre d'insertion), jamais la clé courante.
        for (const k of entries.keys()) { if (entries.size <= maxEntries) break; if (k !== key) entries.delete(k); }
      }
      return cur.n;
    },
    // Secondes avant la fin de la fenêtre (au moins 1).
    retryAfter(key) { const e = live(key, Date.now()); return e ? Math.max(1, Math.ceil((e.until - Date.now()) / 1000)) : 1; },
    delete(key) { entries.delete(key); },
  };
}

module.exports = { HttpError, readBody, readJson, clientIp, originOk, createWindowCounter };
