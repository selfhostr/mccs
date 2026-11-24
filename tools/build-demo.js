#!/usr/bin/env node
'use strict';

// Démo statique de mccs (aucun serveur) : copie public/, préfixe les chemins absolus (/demo/ par défaut),
// écrit une configuration et une feuille de marque statiques, et ajoute la couche démo (tools/demo/) :
// un faux serveur dans le navigateur, construit à partir des modules purs de server/ (réglages, validation,
// référencement, profil Apple), qui répond à /api/* et /support/api/* sans aucun appel réseau.
//
//   node tools/build-demo.js [--out dist/demo] [--base /demo/] [--public-url https://mccs.selfhostr.io/demo]
//                            [--site https://mccs.selfhostr.io]

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SERVER = path.join(ROOT, 'server');
const KIT = path.join(__dirname, 'demo');
const LAYER_DIR = 'demo-layer'; // dossier de la couche démo dans la sortie

// Mêmes extensions que celles servies par server/index.js.
const SERVED = new Set(['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff2', '.txt', '.webmanifest']);
// Modules de server/ embarqués dans le navigateur : purs, sauf store.js (fs, remplacé par un stockage local).
const MODULES = ['validate', 'messages', 'seo', 'settings', 'store', 'config', 'mobileconfig', 'brand'];
// Racines des chemins absolus du front qui désignent un fichier ou une route de l'application.
// /uploads/… n'en fait pas partie : c'est une valeur de réglage (ex. BRAND_LOGO_URL), traitée par la couche démo.
const ROOTS = '(?:api|support|img|js|css|fonts)/|brand\\.css|profile\\.mobileconfig';

function parseArgs(argv) {
  const opts = { out: path.join(ROOT, 'dist', 'demo'), base: '/demo/', publicUrl: 'https://mccs.selfhostr.io/demo', site: 'https://mccs.selfhostr.io' };
  const names = { '--out': 'out', '--base': 'base', '--public-url': 'publicUrl', '--site': 'site' };
  for (let i = 0; i < argv.length; i++) {
    const key = names[argv[i]];
    if (!key || argv[i + 1] === undefined) throw new Error(`Option inconnue ou sans valeur : ${argv[i]}`);
    opts[key] = argv[++i];
  }
  opts.out = path.resolve(opts.out);
  if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(opts.base)) throw new Error('--base doit commencer et finir par « / » (ex. /demo/).');
  opts.publicUrl = opts.publicUrl.replace(/\/+$/, '');
  opts.site = opts.site.replace(/\/+$/, '');
  return opts;
}

// Chemins absolus réécrits sous le préfixe (fonctions pures, testées dans test/build-demo.test.js).
function rewriteHtml(html, base) {
  return html.replace(/((?:href|src|action)=")\/(?!\/)/g, '$1' + base);
}
function rewriteJs(js, base) {
  return js
    .replace(new RegExp('([\'"`])/(?=' + ROOTS + ')', 'g'), '$1' + base)
    // Lien vers l'accueil du site client (h('a', { href: '/' })).
    .replace(/(\bhref:\s*)'\/'/g, `$1'${base}'`);
}
// Chemins absolus restants (doit être vide après réécriture).
function leftovers(text, base) {
  if (base === '/') return [];
  const out = [];
  const at = (i) => text.slice(i, i + 48).split('\n')[0];
  for (const m of text.matchAll(/(?:href|src|action)="\/(?!\/)/g)) if (!text.startsWith(base.slice(1), m.index + m[0].length)) out.push(at(m.index));
  for (const m of text.matchAll(new RegExp('[\'"`]/(?:' + ROOTS + ')', 'g'))) out.push(at(m.index));
  for (const m of text.matchAll(/\bhref:\s*'\/'/g)) out.push(at(m.index));
  return out;
}

// Modules CommonJS de server/ enveloppés pour le navigateur : mccsServer(builtins, process) renvoie require.
function bundleServer() {
  const parts = MODULES.map((name) => {
    const src = fs.readFileSync(path.join(SERVER, name + '.js'), 'utf8');
    return `  ${JSON.stringify('./' + name)}: function (module, exports, require, process) {\n${src}\n  }`;
  });
  return `var mccsServer = (function () {
  var sources = {
${parts.join(',\n')}
  };
  return function boot(builtins, process) {
    var cache = {};
    function req(name) {
      if (Object.prototype.hasOwnProperty.call(builtins, name)) return builtins[name];
      if (!Object.prototype.hasOwnProperty.call(sources, name)) throw new Error('Module absent de la démo : ' + name);
      if (cache[name]) return cache[name].exports;
      var m = { exports: {} };
      cache[name] = m;
      sources[name](m, m.exports, req, process);
      return m.exports;
    }
    return req;
  };
})();
`;
}

// Configuration effective de la marque fictive, calculée par le vrai code (server/config.js) dans un dossier temporaire.
function seedConfig(seed, publicUrl) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-demo-'));
  try {
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ version: 1, values: seed.settings }));
    if (!process.env.DATA_DIR) process.env.DATA_DIR = dir; // config.js lit aussi DATA_DIR à son chargement
    const { createSettings, publicConfigOf } = require(path.join(SERVER, 'config'));
    const { config } = createSettings({ env: Object.assign({}, seed.env, { PUBLIC_URL: publicUrl }), dir });
    return { config: JSON.parse(JSON.stringify(config)), publicConfigOf };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function walk(dir, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else if (SERVED.has(path.extname(e.name).toLowerCase())) out.push(rel);
  }
  return out.sort();
}

function build(opts) {
  const { out, base, publicUrl, site } = opts;
  const seed = JSON.parse(fs.readFileSync(path.join(KIT, 'seed.json'), 'utf8'));
  const { config, publicConfigOf } = seedConfig(seed, publicUrl);
  const { renderHead, injectHead } = require(path.join(SERVER, 'seo'));
  const { brandCss } = require(path.join(SERVER, 'brand'));

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const files = walk(PUBLIC);
  const shots = files.filter((f) => f.startsWith('img/guides/') && /\.(png|jpe?g|webp)$/i.test(f)).map((f) => f.slice('img/guides/'.length));
  const layerTags = `  <link rel="stylesheet" href="${base}${LAYER_DIR}/demo.css">\n  <script src="${base}${LAYER_DIR}/demo.js"></script>\n</head>`;
  const problems = [];

  for (const rel of files) {
    const src = path.join(PUBLIC, rel);
    const dst = path.join(out, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const ext = path.extname(rel);
    if (ext !== '.html' && ext !== '.js') { fs.copyFileSync(src, dst); continue; }
    let text = fs.readFileSync(src, 'utf8');
    if (ext === '.html') {
      if (rel === 'index.html') text = injectHead(text, renderHead(config));
      text = rewriteHtml(text, base);
      // La couche démo (script classique) s'exécute avant les modules de la page, qui sont différés.
      if (text.includes('<script type="module"')) text = text.replace('</head>', layerTags);
    } else {
      text = rewriteJs(text, base);
    }
    for (const l of leftovers(text, base)) problems.push(`${rel}: ${l}`);
    fs.writeFileSync(dst, text);
  }
  if (problems.length) throw new Error('Chemins absolus non réécrits :\n  ' + problems.join('\n  '));

  // Feuille de marque neutre : la couche démo applique la marque en cours (réglages du navigateur) avant l'affichage.
  fs.writeFileSync(path.join(out, 'brand.css'), brandCss({ brandAccent: '', brandBackground: '' }));
  // Configuration publique de la marque fictive (repli si la couche démo ne répond pas).
  fs.mkdirSync(path.join(out, 'api'), { recursive: true });
  fs.writeFileSync(path.join(out, 'api', 'config'), JSON.stringify(Object.assign(publicConfigOf(config), { shots })));

  const constants = { base, site, shots, seed: { env: seed.env, settings: seed.settings, admin: seed.admin } };
  const layer = fs.readFileSync(path.join(KIT, 'layer.js'), 'utf8');
  fs.mkdirSync(path.join(out, LAYER_DIR), { recursive: true });
  fs.writeFileSync(path.join(out, LAYER_DIR, 'demo.js'),
    '// Démo statique de mccs : généré par tools/build-demo.js, ne pas modifier.\n' +
    bundleServer() + `var DEMO = ${JSON.stringify(constants)};\n` + layer);
  fs.copyFileSync(path.join(KIT, 'demo.css'), path.join(out, LAYER_DIR, 'demo.css'));
  return { out, files: files.length + 4 };
}

module.exports = { parseArgs, rewriteHtml, rewriteJs, leftovers, bundleServer, build };

if (require.main === module) {
  try {
    const r = build(parseArgs(process.argv.slice(2)));
    console.log(`Démo écrite dans ${r.out} (${r.files} fichiers).`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
