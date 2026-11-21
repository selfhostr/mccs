'use strict';

// Test d'un serveur mail sans identifiants : connexion, message d'accueil, passage en TLS
// (direct ou par STARTTLS) avec vérification du certificat. Aucune authentification n'est tentée.
const net = require('net');
const tls = require('tls');

const MAX_LINE = 4096;

// Texte d'un message serveur, nettoyé et raccourci pour l'affichage.
function clean(line) {
  return String(line).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, 200);
}

const isImap = (line) => /^\* OK\b/i.test(line);
const isSmtp = (line) => /^220[ -]/.test(line) || line === '220';

/**
 * probe({ host, port, security, timeoutMs }) -> { ok, greeting?, tls?, error?, detail? }
 * error : 'unreachable' | 'timeout' | 'tls' | 'protocol'.
 * `ca` (facultatif, réservé aux tests) remplace les autorités de certification du système.
 */
function probe({ host, port, security, timeoutMs = 8000, ca }) {
  return new Promise((resolve) => {
    const servername = net.isIP(host) ? undefined : host;
    const tlsOptions = { servername, rejectUnauthorized: true, ca };
    let socket = null;     // socket en clair (STARTTLS) ou TLS (SSL/TLS)
    let secure = null;     // socket TLS une fois négocié
    let stage = 'connect'; // connect -> greeting -> starttls -> tls -> done
    let greeting = '';
    let finished = false;

    const timer = setTimeout(() => finish({ ok: false, error: 'timeout', detail: `Aucune réponse en ${Math.round(timeoutMs / 100) / 10} s.` }), timeoutMs);

    // keep : socket déjà fermé poliment (LOGOUT ou QUIT), on le laisse terminer seul.
    function finish(result, keep) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const s of [secure, socket]) {
        if (!s) continue;
        s.removeAllListeners('data');
        s.on('error', () => {});
        if (keep) setTimeout(() => s.destroy(), 1000).unref(); else s.destroy();
      }
      resolve(result);
    }

    function fail(detail) {
      if (stage === 'connect') return finish({ ok: false, error: 'unreachable', detail });
      if (stage === 'tls') return finish({ ok: false, error: 'tls', detail });
      return finish({ ok: false, error: 'protocol', detail });
    }
    function onError(err) {
      fail((err && err.code) || clean(err && err.message) || 'erreur');
    }
    // Fermeture par le serveur avant la fin du test.
    function onClose() {
      fail('Connexion fermée par le serveur.');
    }

    // Lecture ligne par ligne du socket courant.
    let buf = '';
    let onLine = null;
    function readLines(s) {
      s.on('data', (d) => {
        buf += d.toString('latin1');
        if (buf.length > MAX_LINE && buf.indexOf('\n') < 0) return finish({ ok: false, error: 'protocol', detail: 'Réponse trop longue.' });
        let i;
        while (!finished && onLine && (i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, '');
          buf = buf.slice(i + 1);
          onLine(line);
        }
      });
    }

    function tlsInfo(s) {
      const cert = s.getPeerCertificate() || {};
      return { authorized: s.authorized === true, subject: (cert.subject && cert.subject.CN) || '' };
    }

    // Succès : on se déconnecte proprement (LOGOUT ou QUIT) avant de rendre le résultat.
    function succeed(s, imap) {
      const result = { ok: true, greeting, tls: tlsInfo(s) };
      try { s.end(imap ? 'z LOGOUT\r\n' : 'QUIT\r\n'); } catch { /* déjà fermé */ }
      finish(result, true);
    }

    if (security === 'SSL/TLS') {
      socket = tls.connect(Object.assign({ host, port }, tlsOptions));
      socket.on('error', onError);
      socket.on('close', onClose);
      socket.on('connect', () => { if (stage === 'connect') stage = 'tls'; });
      socket.on('secureConnect', () => {
        stage = 'greeting';
        secure = socket;
        onLine = (line) => {
          if (!isImap(line) && !isSmtp(line)) return finish({ ok: false, error: 'protocol', detail: clean(line) });
          greeting = clean(line);
          succeed(socket, isImap(line));
        };
        readLines(socket);
      });
      return;
    }

    // STARTTLS : accueil en clair, commande STARTTLS (IMAP ou SMTP), puis passage en TLS.
    socket = net.connect({ host, port });
    socket.on('error', onError);
    socket.on('close', onClose);
    socket.on('connect', () => {
      stage = 'greeting';
      let imap = false;
      const upgrade = () => {
        stage = 'tls';
        socket.removeAllListeners('data');
        buf = '';
        onLine = null;
        secure = tls.connect(Object.assign({ socket }, tlsOptions));
        secure.on('error', onError);
        secure.on('close', onClose);
        secure.on('secureConnect', () => {
          stage = 'done';
          succeed(secure, imap);
        });
      };
      const expectSmtpFinal = (code, next) => (line) => {
        if (!line.startsWith(code)) return finish({ ok: false, error: 'protocol', detail: clean(line) });
        if (line[3] === '-') return; // ligne intermédiaire d'une réponse multiligne
        next(line);
      };
      onLine = (line) => {
        if (isImap(line)) {
          imap = true;
          greeting = clean(line);
          stage = 'starttls';
          socket.write('a STARTTLS\r\n');
          onLine = (reply) => {
            if (reply.startsWith('* ')) return; // réponses non étiquetées
            if (/^a OK\b/i.test(reply)) return upgrade();
            finish({ ok: false, error: 'protocol', detail: clean(reply) });
          };
        } else if (isSmtp(line)) {
          if (!greeting) greeting = clean(line);
          if (line[3] === '-') return;
          stage = 'starttls';
          socket.write('EHLO mccs\r\n');
          onLine = expectSmtpFinal('250', () => {
            socket.write('STARTTLS\r\n');
            onLine = expectSmtpFinal('220', upgrade);
          });
        } else {
          finish({ ok: false, error: 'protocol', detail: clean(line) });
        }
      };
      readLines(socket);
    });
  });
}

module.exports = { probe };
