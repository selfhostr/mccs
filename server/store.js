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

  function load(f) {
    let raw;
    try { raw = fs.readFileSync(f, 'utf8'); } catch { return null; }
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== VERSION || typeof data.values !== 'object' || data.values === null) throw new Error('format inconnu');
      const out = {};
      for (const [k, v] of Object.entries(data.values)) if (typeof v === 'string') out[k] = v;
      return out;
    } catch (err) {
      console.error(`Réglages ignorés : ${f} illisible (${err.message}).`);
      return null;
    }
  }

  // Écriture atomique : fichier temporaire dans le même dossier, puis rename.
  function save(f, values) {
    const tmp = f + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ version: VERSION, values }, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, f);
  }

  return {
    writable,
    read: () => load(file) || {},
    write(values) {
      if (!writable) throw new Error('Dossier de réglages en lecture seule : ' + dir);
      if (fs.existsSync(file)) fs.copyFileSync(file, prev);
      save(file, values);
    },
    restorePrevious() {
      if (!writable) return false;
      const old = load(prev);
      if (!old) return false;
      const cur = load(file);
      save(file, old);
      if (cur) save(prev, cur);
      return true;
    },
  };
}

module.exports = { createStore };
