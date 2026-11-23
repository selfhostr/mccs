'use strict';

// Découverte des services CalDAV et CardDAV d'un serveur, sans identifiants (RFC 6764) :
//   1. enregistrements DNS SRV _caldavs._tcp / _carddavs._tcp (et TXT « path= ») du domaine, puis de l'hôte ;
//   2. https://<hôte>/.well-known/caldav et /.well-known/carddav, redirections suivies.
// Une URL n'est retenue que si un service DAV y répond vraiment (voir accepted()). Sans identifiants,
// on ne connaît pas l'URL personnelle du client : on retient l'URL de contexte (après redirection),
// à partir de laquelle les applications (DAVx⁵, iOS/macOS, Thunderbird, CalDAV Synchronizer) trouvent le reste.
//
// Rigueur réseau identique à probe.js : TLS vérifié (rejectUnauthorized), https:// uniquement, délai global,
// en-têtes et corps bornés, toutes les connexions fermées avant de rendre le résultat.
// Les requêtes partent du serveur mccs vers l'hôte saisi par l'administrateur (authentifié), y compris si
// ce nom désigne une adresse de réseau interne : voir docs/security.md.
const dns = require('dns');
const https = require('https');
const net = require('net');

const MAX_REDIRECTS = 5;
const MAX_BODY = 64 * 1024;   // le corps n'est pas utilisé : lu au plus jusque-là, puis la connexion est coupée
const MAX_HEADER = 16 * 1024;
const MAX_DETAILS = 40;
const REDIRECTS = [301, 302, 303, 307, 308];
const PROPFIND_BODY = '<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>\n';
const MDAEMON_RE = /\b(?:MDaemon|WDaemon|WorldClient)\b/i;
const HOST_RE = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

const SERVICES = {
  caldav: { srv: '_caldavs._tcp.', wellKnown: '/.well-known/caldav', feature: 'calendar-access' },
  carddav: { srv: '_carddavs._tcp.', wellKnown: '/.well-known/carddav', feature: 'addressbook' },
};

// Texte affichable : sans caractères de contrôle, raccourci.
const clean = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 300);

function origin(host, port) {
  return 'https://' + (net.isIPv6(host) ? `[${host}]` : host) + (port && Number(port) !== 443 ? ':' + port : '');
}

// mail.acme.example -> [acme.example, mail.acme.example] ; acme.example -> [acme.example].
function srvDomains(host) {
  if (net.isIP(host)) return [];
  const labels = host.split('.');
  const out = labels.length > 2 ? [labels.slice(1).join('.'), host] : [host];
  return [...new Set(out.map((d) => d.toLowerCase()))];
}

function errorText(err) {
  const code = (err && err.code) || '';
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME/.test(code)) return `certificat refusé (${code})`;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'nom introuvable';
  if (code === 'ECONNREFUSED') return 'connexion refusée';
  if (code === 'ECONNRESET') return 'connexion coupée par le serveur';
  if (code === 'HPE_HEADER_OVERFLOW') return 'en-têtes de réponse trop longs';
  return code || clean((err && err.message) || 'erreur');
}

function davFeatures(headers) {
  return String(headers.dav || '').toLowerCase().split(',').map((s) => s.trim());
}

/**
 * discover({ host, port, timeoutMs, ca, resolveSrv, resolveTxt, domains })
 *   -> Promise<{ caldav: { url, via } | null, carddav: { url, via } | null, server: 'mdaemon' | 'generic', details: string[] }>
 * via : 'dns' (SRV) ou 'well-known'. `ca`, `resolveSrv`, `resolveTxt` et `domains` (domaines où chercher les SRV,
 * déduits de l'hôte par défaut) servent surtout aux tests.
 */
async function discover({ host, port = 443, timeoutMs = 8000, ca, resolveSrv, resolveTxt, domains }) {
  host = String(host || '').trim().replace(/\.$/, '');
  if (!HOST_RE.test(host) && !net.isIP(host)) throw new TypeError('Nom de serveur invalide.');
  const deadline = Date.now() + timeoutMs;
  const details = [];
  const active = new Set();
  const found = { caldav: null, carddav: null };
  let mdaemon = false;
  let done = false;
  const log = (s) => { if (!done && details.length < MAX_DETAILS) details.push(clean(s)); };

  let resolver = null;
  if (!resolveSrv || !resolveTxt) resolver = new dns.promises.Resolver({ timeout: Math.min(3000, timeoutMs), tries: 2 });
  const srvFn = resolveSrv || ((n) => resolver.resolveSrv(n));
  const txtFn = resolveTxt || ((n) => resolver.resolveTxt(n));

  // Promesse rejetée si le délai global est dépassé avant elle.
  function inTime(p) {
    let t;
    const late = new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error('délai'), { code: 'ETIMEOUT' })), Math.max(0, deadline - Date.now())); });
    return Promise.race([Promise.resolve().then(() => p), late]).finally(() => clearTimeout(t));
  }

  function noteServer(headers) {
    if (MDAEMON_RE.test(String(headers.server || '')) || MDAEMON_RE.test(String(headers['www-authenticate'] || ''))) mdaemon = true;
  }

  // Une requête sans suivi de redirection : { status, headers } ou { error }.
  function request(url, method) {
    return new Promise((resolve) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0 || done) { resolve({ error: 'pas de réponse dans le délai' }); return; }
      const u = new URL(url);
      const hostname = u.hostname.replace(/^\[|\]$/g, '');
      const body = method === 'PROPFIND' ? PROPFIND_BODY : '';
      // En-têtes en ASCII uniquement : certains serveurs (Open-Xchange) répondent 400 sinon.
      const headers = { 'User-Agent': 'mccs/1.0 (CalDAV/CardDAV discovery)', Accept: 'application/xml, text/xml;q=0.9, */*;q=0.1', Connection: 'close' };
      if (body) Object.assign(headers, { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      let settled = false;
      let timer = null;
      const finish = (v) => { if (settled) return; settled = true; clearTimeout(timer); resolve(v); };
      let req;
      try {
        req = https.request({
          host: hostname, port: u.port || 443, path: u.pathname + u.search, method, headers,
          servername: net.isIP(hostname) ? undefined : hostname,
          rejectUnauthorized: true, ca, agent: false, maxHeaderSize: MAX_HEADER,
        });
      } catch (err) { finish({ error: errorText(err) }); return; }
      active.add(req);
      timer = setTimeout(() => { finish({ error: 'pas de réponse dans le délai' }); req.destroy(); }, remaining);
      req.on('response', (res) => {
        finish({ status: res.statusCode, headers: res.headers });
        let size = 0;
        res.on('data', (d) => { size += d.length; if (size > MAX_BODY) req.destroy(); });
        res.on('end', () => req.destroy());
        res.on('error', () => {});
      });
      req.on('error', (err) => finish({ error: errorText(err) }));
      req.on('close', () => { active.delete(req); finish({ error: 'connexion fermée sans réponse' }); });
      req.end(body || undefined);
    });
  }

  // Suit les redirections depuis `start` et renvoie l'URL de contexte si un service DAV y répond.
  // trusted : l'URL vient du DNS (SRV), qui désigne explicitement le service.
  async function probeUrl(start, svc, trusted) {
    let url = start;
    const seen = new Set();
    let hops = 0;
    for (;;) {
      if (seen.has(url)) { log(`Boucle de redirection sur ${url} : abandon.`); return null; }
      seen.add(url);
      const r = await request(url, 'PROPFIND');
      if (r.error) { log(`${url} : ${r.error}.`); return null; }
      noteServer(r.headers);
      if (REDIRECTS.includes(r.status)) {
        let next = null;
        try { next = new URL(String(r.headers.location || ''), url); } catch { /* invalide */ }
        if (!r.headers.location || !next) { log(`${url} : redirection ${r.status} sans adresse valide.`); return null; }
        if (next.protocol !== 'https:') { log(`${url} : redirection vers ${next.origin} refusée (seules les adresses https:// sont suivies).`); return null; }
        if (hops >= MAX_REDIRECTS) { log(`${url} : trop de redirections (plus de ${MAX_REDIRECTS}) : abandon.`); return null; }
        next.hash = '';
        log(`${url} : redirection ${r.status} vers ${next.href}`);
        url = next.href;
        hops++;
        continue;
      }
      log(`PROPFIND ${url} : réponse ${r.status}${r.headers.dav ? ` (DAV : ${r.headers.dav})` : ''}.`);
      if (accepted(r, svc, trusted || hops > 0)) return url;
      const o = await request(url, 'OPTIONS');
      if (o.error) { log(`OPTIONS ${url} : ${o.error}.`); return null; }
      noteServer(o.headers);
      log(`OPTIONS ${url} : réponse ${o.status}${o.headers.dav ? ` (DAV : ${o.headers.dav})` : ''}.`);
      return davFeatures(o.headers).includes(svc.feature) ? url : null;
    }
  }

  // Preuve qu'un service DAV répond : 207 Multi-Status ; ou en-tête DAV annonçant le service ;
  // ou 401 avec WWW-Authenticate quand l'adresse est sûre (SRV, ou atteinte par une redirection de /.well-known).
  function accepted(r, svc, sure) {
    if (r.status === 207) return true;
    if (davFeatures(r.headers).includes(svc.feature)) return true;
    return r.status === 401 && Boolean(r.headers['www-authenticate']) && sure;
  }

  async function viaDns(svc) {
    for (const d of domains || srvDomains(host)) {
      if (done) return null;
      const name = svc.srv + d;
      let recs;
      try { recs = await inTime(srvFn(name)); } catch (err) {
        const c = err && err.code;
        log(c === 'ENOTFOUND' || c === 'ENODATA' ? `DNS : aucun enregistrement ${name}.` : `DNS : ${name} sans réponse (${c || 'erreur'}).`);
        continue;
      }
      const usable = (Array.isArray(recs) ? recs : [])
        .map((x) => ({ name: String((x && x.name) || '').replace(/\.$/, ''), port: Number(x && x.port), priority: Number(x && x.priority) || 0, weight: Number(x && x.weight) || 0 }))
        .filter((x) => x.name && HOST_RE.test(x.name) && x.port > 0 && x.port < 65536)
        .sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      if (!usable.length) { log(`DNS : ${name} n’indique aucun serveur utilisable.`); continue; }
      let path = svc.wellKnown;
      try {
        const txt = await inTime(txtFn(name));
        for (const rec of Array.isArray(txt) ? txt : []) {
          const m = /^path=(\/[^\s]*)$/.exec([].concat(rec).join(''));
          if (m) { path = m[1]; break; }
        }
      } catch { /* pas de TXT : /.well-known sur la cible */ }
      const target = usable[0];
      const start = origin(target.name, target.port) + path;
      log(`DNS : ${name} désigne ${start}`);
      const url = await probeUrl(start, svc, true);
      if (url) return { url, via: 'dns' };
    }
    return null;
  }

  async function findService(kind) {
    const svc = SERVICES[kind];
    let r = await viaDns(svc);
    if (!r && !done) {
      const url = await probeUrl(origin(host, port) + svc.wellKnown, svc, false);
      if (url) r = { url, via: 'well-known' };
    }
    if (r && /\/webdav(?:\/|$)/i.test(new URL(r.url).pathname)) mdaemon = true;
    found[kind] = r;
    return r;
  }

  let timer;
  const expired = new Promise((resolve) => { timer = setTimeout(resolve, Math.max(0, deadline - Date.now()) + 50); });
  await Promise.race([Promise.all([findService('caldav'), findService('carddav')]), expired]);
  clearTimeout(timer);
  if (Date.now() >= deadline) log(`Délai de ${Math.round(timeoutMs / 100) / 10} s dépassé.`);
  done = true;
  for (const req of active) req.destroy();
  if (resolver) resolver.cancel();
  return { caldav: found.caldav, carddav: found.carddav, server: mdaemon ? 'mdaemon' : 'generic', details };
}

module.exports = { discover };
