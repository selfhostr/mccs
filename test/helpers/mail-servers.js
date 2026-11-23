'use strict';

// Faux serveurs mail locaux pour tester probe() : TLS direct, STARTTLS (IMAP ou SMTP), serveur muet.
// Le certificat est autosigné (test/helpers/cert.pem, clé de test uniquement).
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const tls = require('node:tls');

const key = fs.readFileSync(path.join(__dirname, 'key.pem'));
const cert = fs.readFileSync(path.join(__dirname, 'cert.pem'));

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function close(server) {
  return new Promise((resolve) => {
    if (server.closeAllConnections) server.closeAllConnections();
    server.close(() => resolve());
  });
}

// Lit le flux ligne par ligne ; renvoie une fonction qui détache l'écouteur.
function onLines(socket, fn) {
  let buf = '';
  const onData = (d) => {
    buf += d.toString('latin1');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      fn(line);
    }
  };
  socket.on('data', onData);
  return () => socket.removeListener('data', onData);
}

// Garde la trace des sockets pour pouvoir tout fermer à la fin du test.
function track(server) {
  const sockets = new Set();
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); s.on('error', () => {}); });
  const origClose = server.close.bind(server);
  server.close = (cb) => { for (const s of sockets) s.destroy(); return origClose(cb); };
  return server;
}

// Serveur TLS direct (port 993 ou 465) : envoie le message d'accueil dès la poignée de main.
function tlsServer(greeting = '* OK IMAP4rev1 prêt') {
  const server = tls.createServer({ key, cert }, (s) => {
    s.on('error', () => {});
    s.write(greeting + '\r\n');
  });
  server.on('tlsClientError', () => {});
  return listen(track(server));
}

function upgrade(socket) {
  const secure = new tls.TLSSocket(socket, { isServer: true, key, cert });
  secure.on('error', () => {});
  return secure;
}

// Serveur IMAP en clair qui accepte « a STARTTLS ».
function imapStarttls() {
  return listen(track(net.createServer((s) => {
    s.write('* OK [CAPABILITY IMAP4rev1 STARTTLS] prêt\r\n');
    const stop = onLines(s, (line) => {
      const m = /^(\S+) STARTTLS$/i.exec(line);
      if (m) { stop(); s.write(m[1] + ' OK Begin TLS negotiation now\r\n'); upgrade(s); }
      else s.write('* BAD commande inconnue\r\n');
    });
  })));
}

// Serveur SMTP en clair : accueil sur plusieurs lignes, EHLO, puis STARTTLS.
function smtpStarttls() {
  return listen(track(net.createServer((s) => {
    s.write('220-mail.example.test ESMTP\r\n220 prêt\r\n');
    const stop = onLines(s, (line) => {
      if (/^EHLO /i.test(line)) s.write('250-mail.example.test\r\n250-SIZE 10240000\r\n250-STARTTLS\r\n250 HELP\r\n');
      else if (/^STARTTLS$/i.test(line)) { stop(); s.write('220 2.0.0 Ready to start TLS\r\n'); upgrade(s); }
      else s.write('500 commande inconnue\r\n');
    });
  })));
}

// Serveur qui répond autre chose qu'un serveur mail.
function wrongProtocol() {
  return listen(track(net.createServer((s) => { s.write('HTTP/1.1 400 Bad Request\r\n\r\n'); })));
}

// Serveur qui accepte la connexion et ne dit rien.
function mute() {
  return listen(track(net.createServer(() => {})));
}

// Port fermé : on ouvre un port puis on le libère.
async function closedPort() {
  const s = await listen(net.createServer());
  const { port } = s.address();
  await close(s);
  return port;
}

module.exports = { cert, tlsServer, imapStarttls, smtpStarttls, wrongProtocol, mute, closedPort, close };
