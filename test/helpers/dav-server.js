'use strict';

// Faux serveur HTTPS CalDAV/CardDAV pour tester discover() : chaque test fournit son propre
// gestionnaire (req, res). Certificat autosigné de test (CN=localhost), comme mail-servers.js.
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const key = fs.readFileSync(path.join(__dirname, 'key.pem'));
const cert = fs.readFileSync(path.join(__dirname, 'cert.pem'));

// Démarre le serveur ; `requests` garde « MÉTHODE chemin » de chaque requête reçue.
function davServer(handler) {
  const requests = [];
  const sockets = new Set();
  const server = https.createServer({ key, cert }, (req, res) => {
    requests.push(req.method + ' ' + req.url);
    handler(req, res);
  });
  server.on('secureConnection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({
      port: server.address().port,
      requests,
      sockets,
      close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r()); }),
    });
  }));
}

// Réponses usuelles.
const redirect = (res, location, status = 301) => { res.writeHead(status, { Location: location }); res.end(); };
const multistatus = (res, headers = {}) => {
  res.writeHead(207, Object.assign({ 'Content-Type': 'application/xml; charset=utf-8' }, headers));
  res.end('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"/>');
};
const unauthorized = (res, headers = {}) => {
  res.writeHead(401, Object.assign({ 'WWW-Authenticate': 'Basic realm="dav"' }, headers));
  res.end();
};
const notFound = (res) => { res.writeHead(404); res.end(); };

module.exports = { davServer, cert, redirect, multistatus, unauthorized, notFound };
