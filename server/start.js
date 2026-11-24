'use strict';

// Point d'entrée du conteneur. Démarré en root (compose : user "0:0"), il donne le dossier de
// données à l'utilisateur de l'app (un dossier monté depuis l'hôte appartient souvent à root),
// puis abandonne les droits root avant de charger le serveur. Démarré sans root : rien à faire.
const fs = require('node:fs');
const path = require('node:path');

const APP_UID = 1000; // utilisateur « node » de l'image node:alpine
const APP_GID = 1000;

const realSys = {
  getuid: () => (process.getuid ? process.getuid() : -1),
  readdir: (d) => fs.readdirSync(d),
  lstat: (p) => fs.lstatSync(p),
  chown: (p, u, g) => fs.lchownSync(p, u, g),
  setgroups: (g) => process.setgroups(g),
  setgid: (g) => process.setgid(g),
  setuid: (u) => process.setuid(u),
};

function chownTree(p, uid, gid, sys) {
  const st = sys.lstat(p);
  if (st.uid !== uid || st.gid !== gid) sys.chown(p, uid, gid);
  if (st.isDirectory() && !st.isSymbolicLink()) for (const name of sys.readdir(p)) chownTree(path.join(p, name), uid, gid, sys);
}

// Renvoie { dropped, warning } ; ne lève jamais d'exception.
function prepareDataDir({ dir, uid = APP_UID, gid = APP_GID, sys = realSys }) {
  if (sys.getuid() !== 0) return { dropped: false, warning: null };
  const problems = [];
  try { chownTree(dir, uid, gid, sys); } catch (err) { problems.push(`${dir} n'a pas pu être donné à ${uid}:${gid} (${err.code || err.message})`); }
  try {
    sys.setgroups([]);
    sys.setgid(gid);
    sys.setuid(uid);
  } catch (err) {
    problems.push(`les droits root n'ont pas pu être abandonnés (${err.code || err.message})`);
    return { dropped: false, warning: `Démarrage en root : ${problems.join(' ; ')}. Ajoutez au compose cap_add: [CHOWN, SETUID, SETGID, DAC_READ_SEARCH], ou retirez user: "0:0" et lancez sudo chown -R ${uid}:${gid} sur le dossier monté sur ${dir}.` };
  }
  return { dropped: true, warning: problems.length ? problems.join(' ; ') + `. Lancez sudo chown -R ${uid}:${gid} sur le dossier monté sur ${dir}.` : null };
}

module.exports = { prepareDataDir, APP_UID, APP_GID };

if (require.main === module) {
  const r = prepareDataDir({ dir: process.env.DATA_DIR || '/data' });
  if (r.warning) console.error(r.warning);
  require('./index').start();
}
