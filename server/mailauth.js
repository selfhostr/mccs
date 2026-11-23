'use strict';

// Vérification des identifiants d'un client sur les serveurs mail configurés (POST /api/test).
// IMAP : TLS direct ou STARTTLS, LOGIN puis LOGOUT. SMTP : EHLO, STARTTLS si demandé, AUTH PLAIN
// (ou LOGIN), puis QUIT : aucun message n'est envoyé. Le certificat est toujours vérifié et aucun
// identifiant ne part avant que la connexion soit chiffrée.
//
// Secrets : le mot de passe arrive dans un Buffer ; chaque copie écrite sur le réseau est remise à zéro
// une fois envoyée, et testAccount remet à zéro le Buffer reçu. Rien n'est journalisé : ni le mot de
// passe, ni les réponses du serveur.
const net = require('net');
const tls = require('tls');

const MAX_LINE = 8192;
const MAX_LINES = 200;

// Statuts renvoyés : ok | auth_failed | blocked | unreachable | tls_error | timeout | error.
class Fail extends Error {
  constructor(status) { super(status); this.status = status; }
}

// Réponse du serveur qui signale un compte ou une adresse IP bloqués (anglais et français).
const BLOCKED_RE = /\bblock(?:ed|ing)?\b|\block(?:ed|out)\b|\bbann?ed\b|black-?list|deny-?list|too many|suspend|account (?:is )?disabled|dynamic screening|\[CONTACTADMIN\]|bloqu|verrouill|trop de (?:tentatives|connexions|essais)/i;

// Envoi d'un tampon contenant un secret : il est remis à zéro une fois transmis au système.
function writeSecret(socket, buf) {
  return new Promise((resolve) => {
    socket.write(buf, () => { buf.fill(0); resolve(); });
  });
}

/**
 * Connexion et lecture ligne par ligne, avec un délai global.
 * Lève Fail('unreachable' | 'tls_error' | 'timeout' | 'error').
 */
function openConnection({ host, port, security, timeoutMs, ca }) {
  const servername = net.isIP(host) ? undefined : host;
  const tlsOptions = { servername, rejectUnauthorized: true, ca, minVersion: 'TLSv1.2' };
  let socket = null;
  let stage = 'connect'; // connect -> tls -> open
  let buf = Buffer.alloc(0);
  let lines = 0;
  let waiter = null;     // { resolve, reject } d'une lecture en attente
  let failure = null;    // première erreur, rendue à la prochaine lecture
  let timer = null;
  let onReadyFail = null; // rejet de io.ready tant que la connexion n'est pas établie

  function fail(status) {
    if (!failure) failure = new Fail(status);
    if (waiter) { const w = waiter; waiter = null; w.reject(failure); }
    if (onReadyFail) { const r = onReadyFail; onReadyFail = null; r(failure); }
  }
  function classify(err) {
    const code = (err && err.code) || '';
    if (stage === 'tls') return 'tls_error';
    if (stage === 'connect') {
      // TLS direct : une erreur de certificat ou de poignée de main arrive avant « secureConnect ».
      // Sinon : connexion refusée, nom inconnu, réseau injoignable…
      return /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO|ALTNAME|HOSTNAME|DEPTH/i.test(code) ? 'tls_error' : 'unreachable';
    }
    return 'error';
  }
  const onError = (err) => fail(classify(err));
  const onClose = () => fail(stage === 'connect' ? 'unreachable' : stage === 'tls' ? 'tls_error' : 'error');
  function onData(d) {
    buf = buf.length ? Buffer.concat([buf, d]) : d;
    if (buf.length > MAX_LINE && buf.indexOf('\n') < 0) return fail('error');
    pump();
  }
  function pump() {
    if (!waiter) return;
    const i = buf.indexOf('\n');
    if (i < 0) return;
    const line = buf.subarray(0, i).toString('latin1').replace(/\r$/, '');
    buf = buf.subarray(i + 1);
    if (++lines > MAX_LINES) return fail('error');
    const w = waiter; waiter = null; w.resolve(line);
  }
  function listen(s) {
    s.on('data', onData);
    s.on('error', onError);
    s.on('close', onClose);
  }

  const io = {
    ready: null,
    readLine() {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => { waiter = { resolve, reject }; pump(); });
    },
    write(text) { if (!failure) socket.write(text); },
    writeSecret(b) { if (failure) { b.fill(0); return Promise.resolve(); } return writeSecret(socket, b); },
    // STARTTLS : passage en TLS sur la connexion en clair. Des octets reçus avant la poignée de main
    // seraient injectés hors TLS : la connexion est refusée dans ce cas.
    upgrade() {
      if (buf.length) return Promise.reject(new Fail('error'));
      stage = 'tls';
      socket.removeListener('data', onData);
      socket.removeListener('close', onClose);
      const plain = socket;
      return new Promise((resolve, reject) => {
        socket = tls.connect(Object.assign({ socket: plain }, tlsOptions));
        socket.on('error', () => { fail('tls_error'); reject(failure); });
        socket.once('secureConnect', () => {
          stage = 'open';
          socket.on('data', onData);
          socket.on('close', onClose);
          resolve();
        });
      });
    },
    // Fermeture polie (LOGOUT, QUIT déjà écrits) : on laisse le serveur répondre un instant.
    close(polite) {
      clearTimeout(timer);
      if (!socket) return;
      const s = socket;
      s.removeAllListeners('data');
      s.on('error', () => {});
      if (polite) { try { s.end(); } catch { /* déjà fermé */ } setTimeout(() => s.destroy(), 1000).unref(); } else s.destroy();
    },
  };

  timer = setTimeout(() => { fail('timeout'); if (socket) socket.destroy(); }, timeoutMs);
  timer.unref();

  io.ready = new Promise((resolve, reject) => {
    onReadyFail = reject;
    if (security === 'SSL/TLS') {
      socket = tls.connect(Object.assign({ host, port }, tlsOptions));
      socket.on('connect', () => { if (stage === 'connect') stage = 'tls'; });
      socket.once('secureConnect', () => { stage = 'open'; onReadyFail = null; resolve(); });
    } else {
      socket = net.connect({ host, port });
      socket.once('connect', () => { stage = 'open'; onReadyFail = null; resolve(); });
    }
    listen(socket);
  });
  return io;
}

/* ---------- IMAP ---------- */

// Chaîne IMAP pour LOGIN (RFC 3501, « astring ») : entre guillemets si tous les octets sont de l'ASCII
// imprimable (avec \ et " échappés), sinon littéral {n} (accents, octets non ASCII).
function imapQuoted(bytes) {
  const out = Buffer.alloc(bytes.length * 2 + 2);
  let j = 0;
  out[j++] = 0x22;
  for (const b of bytes) {
    if (b === 0x22 || b === 0x5c) out[j++] = 0x5c;
    out[j++] = b;
  }
  out[j++] = 0x22;
  const res = Buffer.from(out.subarray(0, j));
  out.fill(0);
  return res;
}
const printableAscii = (bytes) => bytes.every((b) => b >= 0x20 && b <= 0x7e);

// Lit jusqu'à la réponse étiquetée « tag » ; renvoie { kind: 'OK'|'NO'|'BAD'|'BYE', text } ou « + » (suite).
async function imapReply(io, tag, { continuation = false } = {}) {
  let bye = '';
  for (;;) {
    const line = await io.readLine().catch((err) => {
      if (bye && err instanceof Fail && err.status === 'error') return null; // BYE puis fermeture
      throw err;
    });
    if (line === null) return { kind: 'BYE', text: bye };
    if (continuation && line.startsWith('+')) return { kind: '+', text: line };
    if (/^\* BYE\b/i.test(line)) { bye = line; continue; }
    if (line.startsWith('* ')) continue;
    const m = new RegExp('^' + tag + ' (OK|NO|BAD)\\b', 'i').exec(line);
    if (m) return { kind: m[1].toUpperCase(), text: line };
  }
}

function imapLoginStatus(r) {
  if (r.kind === 'OK') return 'ok';
  if (BLOCKED_RE.test(r.text)) return 'blocked';
  if (r.kind === 'NO') return /\[UNAVAILABLE\]/i.test(r.text) ? 'error' : 'auth_failed';
  return 'error';
}

async function imapSession(io, user, password) {
  await io.ready;
  const greeting = await io.readLine();
  if (/^\* BYE\b/i.test(greeting)) return 'blocked'; // le serveur refuse cette adresse IP
  if (!/^\* OK\b/i.test(greeting)) return 'error';
  if (io.starttls) {
    io.write('a STARTTLS\r\n');
    const r = await imapReply(io, 'a');
    if (r.kind !== 'OK') return 'error';
    await io.upgrade();
  }
  const userArg = imapQuoted(Buffer.from(user, 'utf8'));
  if (printableAscii(password)) {
    const line = Buffer.concat([Buffer.from('b LOGIN '), userArg, Buffer.from(' '), imapQuoted(password), Buffer.from('\r\n')]);
    await io.writeSecret(line);
  } else {
    // Littéral synchronisant : le serveur doit répondre « + » avant de recevoir les octets.
    io.write(Buffer.concat([Buffer.from('b LOGIN '), userArg, Buffer.from(` {${password.length}}\r\n`)]));
    const cont = await imapReply(io, 'b', { continuation: true });
    if (cont.kind !== '+') return imapLoginStatus(cont);
    const data = Buffer.concat([password, Buffer.from('\r\n')]);
    await io.writeSecret(data);
  }
  const r = await imapReply(io, 'b');
  const status = imapLoginStatus(r);
  if (status === 'ok') {
    // Déconnexion polie ; une réponse manquante ne change pas le résultat.
    io.write('c LOGOUT\r\n');
    await imapReply(io, 'c').catch(() => {});
  }
  return status;
}

/* ---------- SMTP ---------- */

// Réponse SMTP complète (multiligne) : { code, text }.
async function smtpReply(io) {
  const lines = [];
  for (;;) {
    const line = await io.readLine();
    if (!/^\d{3}(?:[ -]|$)/.test(line)) throw new Fail('error');
    lines.push(line);
    if (line[3] !== '-') return { code: Number(line.slice(0, 3)), text: lines.join('\n') };
  }
}

function smtpAuthStatus(r) {
  if (r.code === 235) return 'ok';
  if (BLOCKED_RE.test(r.text)) return 'blocked';
  if (r.code === 535) return 'auth_failed';
  return 'error';
}

async function smtpSession(io, user, password) {
  await io.ready;
  const greeting = await smtpReply(io);
  if (greeting.code !== 220) return BLOCKED_RE.test(greeting.text) || greeting.code === 554 ? 'blocked' : 'error';
  io.write('EHLO mccs\r\n');
  let ehlo = await smtpReply(io);
  if (ehlo.code !== 250) return 'error';
  if (io.starttls) {
    io.write('STARTTLS\r\n');
    const r = await smtpReply(io);
    if (r.code !== 220) return 'error';
    await io.upgrade();
    io.write('EHLO mccs\r\n');
    ehlo = await smtpReply(io);
    if (ehlo.code !== 250) return 'error';
  }
  const authLine = ehlo.text.split('\n').map((l) => l.slice(4)).find((l) => /^AUTH[ =]/i.test(l)) || '';
  const mechs = authLine.slice(5).toUpperCase().split(/\s+/).filter(Boolean);
  let r;
  if (mechs.includes('PLAIN')) {
    const raw = Buffer.concat([Buffer.from([0]), Buffer.from(user, 'utf8'), Buffer.from([0]), password]);
    const line = Buffer.concat([Buffer.from('AUTH PLAIN '), Buffer.from(raw.toString('base64')), Buffer.from('\r\n')]);
    raw.fill(0);
    await io.writeSecret(line);
    r = await smtpReply(io);
  } else if (mechs.includes('LOGIN')) {
    io.write('AUTH LOGIN\r\n');
    r = await smtpReply(io);
    if (r.code === 334) {
      io.write(Buffer.from(user, 'utf8').toString('base64') + '\r\n');
      r = await smtpReply(io);
      if (r.code === 334) {
        await io.writeSecret(Buffer.concat([Buffer.from(password.toString('base64')), Buffer.from('\r\n')]));
        r = await smtpReply(io);
      }
    }
  } else {
    return 'error'; // aucun mécanisme utilisable : identifiants jamais envoyés
  }
  const status = smtpAuthStatus(r);
  if (status === 'ok') {
    io.write('QUIT\r\n');
    await smtpReply(io).catch(() => {});
  }
  return status;
}

/* ---------- Points d'entrée ---------- */

async function run(session, { host, port, security, user, password, timeoutMs = 8000, ca }) {
  const io = openConnection({ host, port, security, timeoutMs, ca });
  io.starttls = security === 'STARTTLS';
  try {
    const status = await session(io, user, password);
    io.close(status === 'ok');
    return status;
  } catch (err) {
    io.close(false);
    return err instanceof Fail ? err.status : 'error';
  }
}

// password : Buffer (UTF-8). Non modifié ici ; voir testAccount.
const testImap = (opts) => run(imapSession, opts);
const testSmtp = (opts) => run(smtpSession, opts);

/**
 * testAccount({ user, password: Buffer, imap: { host, port, security }, smtp: {…}, timeoutMs, ca })
 * -> { imap: { status }, smtp: { status } }. Le SMTP n'est testé qu'après un IMAP réussi (un mauvais
 * mot de passe ne compte qu'une fois côté serveur mail). Le Buffer du mot de passe est remis à zéro.
 */
async function testAccount({ user, password, imap, smtp, timeoutMs, ca }) {
  try {
    const common = { user, password, timeoutMs, ca };
    const i = await testImap(Object.assign({}, common, { host: imap.host, port: imap.port, security: imap.security }));
    const s = i === 'ok' ? await testSmtp(Object.assign({}, common, { host: smtp.host, port: smtp.port, security: smtp.security })) : 'skipped';
    return { imap: { status: i }, smtp: { status: s } };
  } finally {
    password.fill(0);
  }
}

module.exports = { testImap, testSmtp, testAccount, BLOCKED_RE };
