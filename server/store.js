'use strict';

// Stockage des réglages modifiés dans l'admin : <dir>/config.json (+ config.prev.json).
// Format : { "version": 1, "values": { "BRAND_NAME": "Acme", … } }.
const fs = require('fs');
const path = require('path');

const VERSION = 1;

function createStore(dir) {
  const file = path.join(dir, 'config.json');
  const prev = path.join(dir, 'config.prev.json');

  let writable = false;
  try { fs.accessSync(dir, fs.constants.W_OK); writable = fs.statSync(dir).isDirectory(); } catch { writable = false; }

  // Lit un fichier de réglages : { state: 'ok' | 'missing' | 'bad', values }.
  function load(f) {
    let raw;
    try { raw = fs.readFileSync(f, 'utf8'); } catch (err) {
      if (err.code === 'ENOENT') return { state: 'missing', values: {} };
      console.error(`Réglages ignorés : ${f} illisible (${err.code || err.message}).`);
      return { state: 'bad', values: {} };
    }
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== VERSION || typeof data.values !== 'object' || data.values === null || Array.isArray(data.values)) throw new Error('format ou version inconnus');
      // fromEntries : une clé « __proto__ » reste une simple propriété.
      const values = Object.fromEntries(Object.entries(data.values).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v.trim()]));
      return { state: 'ok', values };
    } catch (err) {
      console.error(`Réglages ignorés : ${f} illisible (${err.message}).`);
      return { state: 'bad', values: {} };
    }
  }

  // Écriture atomique : fichier temporaire dans le même dossier, puis rename. Rien ne reste en cas d'échec.
  function save(f, values) {
    const tmp = f + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify({ version: VERSION, values }, null, 2) + '\n', { mode: 0o600 });
      fs.renameSync(tmp, f);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* déjà absent */ }
      throw err;
    }
  }

  return {
    writable,
    read: () => load(file).values,
    write(values) {
      if (!writable) throw new Error('Dossier de réglages en lecture seule : ' + dir);
      const cur = load(file);
      // Un fichier illisible (ou d'une version future) est mis de côté, jamais écrasé sans copie.
      if (cur.state === 'bad' && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const bad = file + '.bad-' + new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(file, bad);
        console.error(`Ancien fichier de réglages conservé dans ${bad}.`);
      } else if (cur.state === 'ok') {
        fs.copyFileSync(file, prev);
      }
      save(file, values);
    },
    restorePrevious() {
      if (!writable) return false;
      const old = load(prev);
      if (old.state !== 'ok') return false;
      const cur = load(file);
      save(file, old.values);
      if (cur.state === 'ok') save(prev, cur.values);
      return true;
    },
  };
}

module.exports = { createStore };
