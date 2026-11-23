'use strict';

// Faux serveurs IMAP et SMTP avec authentification, pour tester server/mailauth.js et POST /api/test.
// Chaque serveur note ce qu'il a reçu (identifiants décodés, commandes) dans server.log.
// TLS direct ou STARTTLS, avec le certificat de test (test/helpers/cert.pem, clé de test uniquement).
const net = require('node:net');
const tls = require('node:tls');
const { cert } = require('./mail-servers');
const fs = require('node:fs');
const path = require('node:path');

const key = fs.readFileSync(path.join(__dirname, 'key.pem'));

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function track(server) {
  const sockets = new Set();
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); s.on('error', () => {}); });
  server.on('secureConnection', (s) => s.on('error', () => {}));
  server.on('tlsClientError', () => {});
  server.stop = () => new Promise((resolve) => { for (const s of sockets) s.destroy(); server.close(() => resolve()); });
  return server;
}

// Lecteur d'octets : lignes (CRLF) et blocs de n octets (littéraux IMAP). Passe d'un socket à l'autre (STARTTLS).
function reader() {
  let buf = Buffer.alloc(0);
  let waiting = null; // { kind: 'line' } | { kind: 'bytes', n }
  let resolveFn = null;
  let socket = null;
  const onData = (d) => { buf = Buffer.concat([buf, d]); pump(); };
  function pump() {
    if (!waiting) return;
    if (waiting.kind === 'line') {
      const i = buf.indexOf('\r\n');
      if (i < 0) return;
      const line = buf.subarray(0, i);
      buf = buf.subarray(i + 2);
      const r = resolveFn; waiting = null; resolveFn = null; r(line);
    } else if (buf.length >= waiting.n) {
      const out = buf.subarray(0, waiting.n);
      buf = buf.subarray(waiting.n);
      const r = resolveFn; waiting = null; resolveFn = null; r(out);
    }
  }
  return {
    attach(s) { if (socket) socket.removeListener('data', onData); socket = s; s.on('data', onData); },
    line() { return new Promise((r) => { waiting = { kind: 'line' }; resolveFn = r; pump(); }); },
    bytes(n) { return new Promise((r) => { waiting = { kind: 'bytes', n }; resolveFn = r; pump(); }); },
    pending: () => buf.length,
  };
}

function upgrade(socket) {
  const secure = new tls.TLSSocket(socket, { isServer: true, key, cert });
  secure.on('error', () => {});
  return secure;
}

// Analyse d'une « astring » IMAP : atome, chaîne entre guillemets (\\ et \") ou littéral {n}.
async function readAstrings(first, rd, send, count) {
  const out = [];
  let rest = first; // Buffer de la ligne en cours, après la commande
  while (out.length < count) {
    while (rest.length && rest[0] === 0x20) rest = rest.subarray(1);
    if (!rest.length) return null;
    if (rest[0] === 0x22) {
      const bytes = [];
      let i = 1;
      for (; i < rest.length; i++) {
        if (rest[i] === 0x5c) { i++; bytes.push(rest[i]); continue; }
        if (rest[i] === 0x22) break;
        bytes.push(rest[i]);
      }
      if (i >= rest.length) return null;
      out.push(Buffer.from(bytes));
      rest = rest.subarray(i + 1);
    } else if (rest[0] === 0x7b) {
      const m = /^\{(\d+)(\+?)\}$/.exec(rest.toString('latin1'));
      if (!m) return null;
      if (!m[2]) send('+ Ready for literal data');
      out.push(await rd.bytes(Number(m[1])));
      rest = await rd.line();
    } else {
      let i = 0;
      while (i < rest.length && rest[i] !== 0x20) i++;
      out.push(rest.subarray(0, i));
      rest = rest.subarray(i);
    }
  }
  return out;
}

/**
 * imapServer({ security, accounts, loginReply, greeting, mute })
 * accounts : { adresse: mot de passe } ; loginReply(user, pass) -> texte après « tag » (remplace le contrôle).
 * greeting : message d'accueil (par défaut « * OK … ») ; mute : ne répond jamais.
 */
async function imapServer({ security = 'SSL/TLS', accounts = {}, loginReply, greeting = '* OK [CAPABILITY IMAP4rev1 STARTTLS AUTH=PLAIN] prêt', mute = false } = {}) {
  const log = { connections: 0, logins: [], commands: [] };
  async function session(raw, secureFromStart) {
    log.connections++;
    if (mute) return;
    let s = raw;
    const rd = reader();
    rd.attach(s);
    const send = (line) => { try { s.write(line + '\r\n'); } catch { /* fermé */ } };
    send(greeting);
    if (/^\* BYE/.test(greeting)) { s.end(); return; }
    let secure = secureFromStart;
    for (;;) {
      const line = await rd.line();
      const text = line.toString('latin1');
      const m = /^(\S+) (\S+)(?: |$)/.exec(text);
      if (!m) { send('* BAD syntaxe'); continue; }
      const [, tag, cmdRaw] = m;
      const cmd = cmdRaw.toUpperCase();
      log.commands.push(cmd);
      if (cmd === 'STARTTLS' && !secure) {
        send(tag + ' OK Begin TLS negotiation now');
        s = upgrade(s);
        rd.attach(s);
        secure = true;
        continue;
      }
      if (cmd === 'LOGIN') {
        const args = await readAstrings(line.subarray(m[0].length), rd, send, 2);
        if (!args) { send(tag + ' BAD arguments'); continue; }
        const user = args[0].toString('utf8');
        const pass = args[1].toString('utf8');
        log.logins.push({ user, pass, secure });
        let reply;
        if (loginReply) reply = loginReply(user, pass);
        else reply = Object.prototype.hasOwnProperty.call(accounts, user) && accounts[user] === pass ? 'OK LOGIN completed' : 'NO [AUTHENTICATIONFAILED] Authentication failed.';
        if (/^BYE /.test(reply)) { send('* ' + reply); s.end(); return; }
        send(tag + ' ' + reply);
        continue;
      }
      if (cmd === 'LOGOUT') { send('* BYE Logging out'); send(tag + ' OK LOGOUT completed'); s.end(); return; }
      if (cmd === 'CAPABILITY') { send('* CAPABILITY IMAP4rev1'); send(tag + ' OK'); continue; }
      send(tag + ' BAD commande inconnue');
    }
  }
  const server = security === 'SSL/TLS'
    ? tls.createServer({ key, cert }, (s) => { session(s, true).catch(() => {}); })
    : net.createServer((s) => { session(s, false).catch(() => {}); });
  track(server);
  server.log = log;
  await listen(server);
  return server;
}

/**
 * smtpServer({ security, accounts, mechs, authReply, greeting, mute })
 * mechs : mécanismes annoncés (['PLAIN', 'LOGIN'] par défaut) ; authReply(user, pass) -> réponse complète.
 */
async function smtpServer({ security = 'SSL/TLS', accounts = {}, mechs = ['PLAIN', 'LOGIN'], authReply, greeting = '220 mail.example.test ESMTP prêt', mute = false } = {}) {
  const log = { connections: 0, logins: [], commands: [], mailFrom: 0 };
  async function session(raw, secureFromStart) {
    log.connections++;
    if (mute) return;
    let s = raw;
    const rd = reader();
    rd.attach(s);
    const send = (line) => { try { s.write(line + '\r\n'); } catch { /* fermé */ } };
    send(greeting);
    if (!/^220/.test(greeting)) { s.end(); return; }
    let secure = secureFromStart;
    const check = (user, pass, mech) => {
      log.logins.push({ user, pass, mech, secure });
      if (authReply) return authReply(user, pass);
      return Object.prototype.hasOwnProperty.call(accounts, user) && accounts[user] === pass ? '235 2.7.0 Authentication successful' : '535 5.7.8 Authentication credentials invalid';
    };
    const b64 = (l) => Buffer.from(l.toString('latin1'), 'base64');
    for (;;) {
      const text = (await rd.line()).toString('latin1');
      const cmd = text.split(' ')[0].toUpperCase();
      log.commands.push(cmd);
      if (cmd === 'EHLO' || cmd === 'HELO') {
        const lines = ['250-mail.example.test', '250-SIZE 10240000'];
        if (!secure) lines.push('250-STARTTLS');
        if (secure && mechs.length) lines.push('250-AUTH ' + mechs.join(' '));
        lines.push('250 HELP');
        send(lines.join('\r\n'));
      } else if (cmd === 'STARTTLS' && !secure) {
        send('220 2.0.0 Ready to start TLS');
        s = upgrade(s);
        rd.attach(s);
        secure = true;
      } else if (cmd === 'AUTH') {
        const [, mech, initial] = text.split(' ');
        if (/^PLAIN$/i.test(mech) && mechs.includes('PLAIN')) {
          let data = initial;
          if (!data) { send('334 '); data = (await rd.line()).toString('latin1'); }
          const parts = b64(data).toString('utf8').split('\u0000');
          send(check(parts[1], parts[2], 'PLAIN'));
        } else if (/^LOGIN$/i.test(mech) && mechs.includes('LOGIN')) {
          send('334 VXNlcm5hbWU6');
          const user = b64(await rd.line()).toString('utf8');
          send('334 UGFzc3dvcmQ6');
          const pass = b64(await rd.line()).toString('utf8');
          send(check(user, pass, 'LOGIN'));
        } else send('504 5.5.4 Unrecognized authentication type');
      } else if (cmd === 'MAIL') {
        log.mailFrom++;
        send('250 2.1.0 Ok');
      } else if (cmd === 'QUIT') {
        send('221 2.0.0 Bye');
        s.end();
        return;
      } else send('502 5.5.2 Error: command not recognized');
    }
  }
  const server = security === 'SSL/TLS'
    ? tls.createServer({ key, cert }, (s) => { session(s, true).catch(() => {}); })
    : net.createServer((s) => { session(s, false).catch(() => {}); });
  track(server);
  server.log = log;
  await listen(server);
  return server;
}

module.exports = { imapServer, smtpServer, cert };
