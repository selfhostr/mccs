'use strict';

// Démarrage : prise en main de /data par l'utilisateur de l'app, puis abandon des droits root.
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareDataDir } = require('../server/start');

function fakeSys({ uid = 0, owners = {}, failChown = false, failSetuid = false } = {}) {
  const calls = [];
  const tree = { '/data': ['config.json', 'uploads'], '/data/uploads': ['logo.png'] };
  return {
    calls,
    getuid: () => uid,
    readdir: (d) => tree[d] || [],
    lstat: (p) => ({ uid: owners[p] ?? 0, gid: owners[p] ?? 0, isDirectory: () => p in tree, isSymbolicLink: () => false }),
    chown: (p, u, g) => { if (failChown) throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); calls.push(['chown', p, u, g]); },
    setgroups: (g) => calls.push(['setgroups', g]),
    setgid: (g) => { if (failSetuid) throw new Error('EPERM'); calls.push(['setgid', g]); },
    setuid: (u) => { if (failSetuid) throw new Error('EPERM'); calls.push(['setuid', u]); },
  };
}

test('en root : /data et son contenu passent à 1000:1000, puis les droits root sont abandonnés', () => {
  const sys = fakeSys();
  const r = prepareDataDir({ dir: '/data', uid: 1000, gid: 1000, sys });
  assert.equal(r.dropped, true);
  const chowned = sys.calls.filter((c) => c[0] === 'chown').map((c) => c[1]).sort();
  assert.deepEqual(chowned, ['/data', '/data/config.json', '/data/uploads', '/data/uploads/logo.png']);
  const order = sys.calls.map((c) => c[0]);
  assert.ok(order.lastIndexOf('chown') < order.indexOf('setgid') && order.indexOf('setgid') < order.indexOf('setuid'));
});

test('les fichiers déjà à 1000 ne sont pas touchés', () => {
  const sys = fakeSys({ owners: { '/data': 1000, '/data/config.json': 1000, '/data/uploads': 1000, '/data/uploads/logo.png': 1000 } });
  prepareDataDir({ dir: '/data', uid: 1000, gid: 1000, sys });
  assert.equal(sys.calls.filter((c) => c[0] === 'chown').length, 0);
});

test('sans root : rien n’est tenté', () => {
  const sys = fakeSys({ uid: 1000 });
  assert.deepEqual(prepareDataDir({ dir: '/data', uid: 1000, gid: 1000, sys }), { dropped: false, warning: null });
  assert.deepEqual(sys.calls, []);
});

test('root sans les capacités nécessaires : un avertissement clair, pas de plantage', () => {
  const sys = fakeSys({ failChown: true, failSetuid: true });
  const r = prepareDataDir({ dir: '/data', uid: 1000, gid: 1000, sys });
  assert.equal(r.dropped, false);
  assert.match(r.warning, /1000:1000/);
});
