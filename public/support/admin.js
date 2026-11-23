// Espace d'administration /support : assistant d'installation, réglages, liens clients et compte.
// Contrat d'API : docs/superpowers/plans/2026-11-21-pr3-espace-admin.md (routes /support/api/*).
import { createControl, resolver, exampleEmail, davUrl, backgroundCss, optionLabel, isHost, presetFor, DEFAULTS, h, ICONS } from '/support/fields.js';
import { initLinks, reloadConfig, toast } from '/support/support.js';

const $ = (s, root = document) => root.querySelector(s);
let state = null; // { brand, writable, setupDone, fields, passwordFromEnv }

const MAIL_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
const INFO_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
const WARN_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/></svg>';
const CHECK_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const SHIELD_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/></svg>';

/* ---------- Échanges avec le serveur ---------- */
// Renvoie { status, data } ; status 0 = réseau. Une session expirée renvoie vers la page de connexion.
async function api(method, path, body, file) {
  const init = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' };
  if (file) { init.body = file; init.headers['Content-Type'] = file.type; }
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(path, init); } catch { return { status: 0, data: {} }; }
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (res.status === 401 && data.error === 'session') {
    location.href = '/support/login.html?expire=1';
    return new Promise(() => {});
  }
  return { status: res.status, data: data || {} };
}
const READONLY_MSG = 'Le dossier de données /data est en lecture seule : rien ne peut y être enregistré.';
const minutes = (s) => Math.max(1, Math.ceil((Number(s) || 60) / 60));
function failMessage(r) {
  const e = (r.data && r.data.error) || '';
  if (r.status === 0) return 'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.';
  if (r.status === 403) return 'Requête refusée par le serveur. Rechargez la page puis réessayez.';
  if (r.status === 409 && e === 'readonly') return READONLY_MSG;
  if (r.status === 413) return 'Envoi trop volumineux.';
  if (r.status === 429) return `Trop d’essais. Réessayez dans ${minutes(r.data.retryAfter)} minute${minutes(r.data.retryAfter) > 1 ? 's' : ''}.`;
  if (r.status === 400 || r.status === 404 || r.status === 405) return `Requête refusée par le serveur (${e || r.status}). Rechargez la page puis réessayez.`;
  return `Erreur du serveur (${r.status}). Réessayez dans un instant.`;
}
async function upload(kind, file) {
  const r = await api('POST', '/support/api/upload?kind=' + kind, undefined, file);
  if (r.status === 200 && r.data.ok && r.data.path) return r.data.path;
  if (r.status === 413) throw new Error('Image trop lourde : 2 Mo au maximum.');
  if (r.status === 415) throw new Error('Format refusé : le fichier n’est pas une image PNG, JPEG ou WebP valide.');
  throw new Error(failMessage(r));
}
const fieldMap = () => new Map(state.fields.map((f) => [f.key, f]));
const savedValue = (f) => (f.source === 'admin' ? String(f.value || '') : '');

// Valeurs connues pour le calcul des valeurs déduites : contrôles affichés, sinon valeurs enregistrées.
function entries(ctrls) {
  const m = new Map();
  for (const f of state.fields) m.set(f.key, ctrls.get(f.key) || { field: f, value: savedValue(f) });
  return m;
}
function applyHints(ctrls) {
  const r = resolver(entries(ctrls));
  for (const c of ctrls.values()) c.setHint(r.fallback(c.key));
  return r;
}

function setBusy(btn, busy, label) {
  btn.disabled = busy;
  btn.classList.toggle('is-busy', busy);
  if (busy && label) { btn.dataset.label = btn.textContent; btn.textContent = label; }
  if (!busy && btn.dataset.label) { btn.textContent = btn.dataset.label; delete btn.dataset.label; }
}
function callout(kind, icon, title, ...body) {
  return h('div', { class: 'callout adm-callout' + (kind ? ' callout-' + kind : '') }, h('span', { html: icon }), h('div', {}, title ? h('p', { class: 'callout-title', text: title }) : null, ...body));
}

/* ---------- Composants partagés : aperçu de marque, serveurs, aperçu DAV ---------- */
function brandPreview() {
  const logo = h('img', { class: 'pv-logo', alt: '', hidden: true });
  const mark = h('span', { class: 'pv-mark', html: MAIL_ICON });
  const name = h('span', { class: 'pv-name' });
  const screen = h('div', { class: 'pv-screen' },
    h('div', { class: 'pv-bar' }, logo, mark, name),
    h('div', { class: 'pv-card' },
      h('p', { class: 'pv-title', text: 'Configurons votre messagerie' }),
      h('p', { class: 'pv-sub', text: 'Indiquez votre nom et votre adresse e-mail. Nous vous guidons ensuite pas à pas.' }),
      h('span', { class: 'pv-label', text: 'Votre adresse e-mail' }),
      h('span', { class: 'pv-input', text: 'prenom.nom@example.com' }),
      h('span', { class: 'pv-btn' }, h('span', { text: 'Continuer' }), h('span', { 'aria-hidden': 'true', class: 'pv-arrow' }))));
  const node = h('figure', { class: 'pv' },
    h('figcaption', { class: 'pv-cap' }, h('span', { text: 'Aperçu de la page d’accueil' }), h('span', { class: 'pv-live', text: 'en direct' })),
    screen,
    h('p', { class: 'pv-note', text: 'L’aperçu suit le thème clair ou sombre de votre appareil, comme pour vos clients.' }));
  function update(resolve, savedLogo) {
    const brand = resolve('BRAND_NAME') || 'mccs';
    name.textContent = brand;
    const l = resolve('BRAND_LOGO_URL');
    const showLogo = Boolean(l) && (/^\/(?:img|uploads)\//.test(l) || l === savedLogo);
    logo.hidden = !showLogo;
    if (showLogo) { if (logo.getAttribute('src') !== l) logo.src = l; logo.alt = brand; } else logo.removeAttribute('src');
    mark.hidden = showLogo;
    name.hidden = showLogo;
    const accent = resolve('BRAND_ACCENT');
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) { screen.style.setProperty('--pv-accent', accent); screen.style.setProperty('--pv-on', '#ffffff'); }
    else { screen.style.removeProperty('--pv-accent'); screen.style.removeProperty('--pv-on'); }
    const bg = backgroundCss(resolve('BRAND_BACKGROUND'));
    if (bg) screen.style.setProperty('--pv-bg', bg); else screen.style.removeProperty('--pv-bg');
  }
  return { node, update };
}

const PROBE_ERRORS = {
  unreachable: ['Serveur injoignable', 'mccs n’a pas pu joindre ce serveur. Vérifiez le nom et le port, et qu’aucun pare-feu ne bloque la connexion.'],
  timeout: ['Pas de réponse', 'Le serveur n’a pas répondu en 8 secondes. Le port est peut-être filtré par un pare-feu.'],
  tls: ['Certificat refusé', 'Le serveur répond, mais son certificat de sécurité n’est pas valide pour ce nom (expiré, autosigné ou établi pour un autre nom). Les applications de vos clients afficheront une alerte ou refuseront de se connecter.'],
};
function probeText(kind, r) {
  const d = r.data || {};
  if (r.status === 200 && d.ok) {
    if (d.tls && d.tls.authorized === false) return { ok: false, title: PROBE_ERRORS.tls[0], text: PROBE_ERRORS.tls[1], detail: d.greeting };
    return { ok: true, title: 'Connexion réussie', text: 'Le serveur répond et son certificat de sécurité est valide.', detail: d.greeting };
  }
  if (r.status === 200 && PROBE_ERRORS[d.error]) return { ok: false, title: PROBE_ERRORS[d.error][0], text: PROBE_ERRORS[d.error][1], detail: d.detail };
  if (r.status === 200 && d.error === 'protocol') {
    const what = kind === 'imap' ? 'un serveur de réception (IMAP)' : 'un serveur d’envoi (SMTP)';
    return { ok: false, title: 'Réponse inattendue', text: `Le serveur a répondu, mais pas comme ${what}. Vérifiez le port et le type de sécurité.`, detail: d.detail };
  }
  if (r.status === 422 || r.status === 400) return { ok: false, title: 'Test impossible', text: 'Vérifiez le nom du serveur et le port, puis relancez le test.' };
  return { ok: false, title: 'Test impossible', text: failMessage(r) };
}

// Bloc « Réception » ou « Envoi » : hôte, port, sécurité et bouton « Tester ».
function serverBlock(kind, ctrls, getResolve) {
  const P = kind === 'imap' ? 'IMAP' : 'SMTP';
  const host = ctrls.get(P + '_HOST');
  const port = ctrls.get(P + '_PORT');
  const sec = ctrls.get(P + '_SECURITY');
  if (!host && !port && !sec) return null;
  const result = h('div', { class: 'probe-result', 'aria-live': 'polite' });
  const btn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm probe-btn', text: 'Tester' });
  btn.addEventListener('click', async () => {
    const resolve = getResolve();
    const target = { host: resolve(P + '_HOST'), port: resolve(P + '_PORT'), security: resolve(P + '_SECURITY') };
    if (host && !host.validate()) { host.focus(); return; }
    if (port && !port.validate()) { port.focus(); return; }
    if (!isHost(target.host)) { result.replaceChildren(h('p', { class: 'probe-msg is-err', text: 'Indiquez d’abord un nom de serveur valide.' })); return; }
    setBusy(btn, true, 'Test en cours…');
    result.replaceChildren(h('p', { class: 'probe-wait', text: `Connexion à ${target.host}, port ${target.port} (${target.security})…` }));
    const r = await api('POST', '/support/api/probe', { host: target.host, port: String(target.port), security: target.security });
    setBusy(btn, false);
    if (r.status === 422 && r.data.errors) {
      const map = { host, port, security: sec };
      for (const [k, msg] of Object.entries(r.data.errors)) if (map[k]) map[k].setError(msg);
    }
    const m = probeText(kind, r);
    result.replaceChildren(h('div', { class: 'probe-msg ' + (m.ok ? 'is-ok' : 'is-err') },
      h('span', { class: 'probe-icon', html: m.ok ? CHECK_ICON : WARN_ICON }),
      h('div', {},
        h('p', { class: 'probe-title', text: `${m.title} · ${target.host}:${target.port}` }),
        h('p', { text: m.text }),
        m.detail ? h('p', { class: 'probe-detail' }, h('span', { text: m.ok ? 'Message du serveur : ' : 'Détail technique : ' }), h('code', { text: m.detail })) : null)));
  });
  const legend = kind === 'imap' ? 'Réception des e-mails' : 'Envoi des e-mails';
  const tag = kind === 'imap' ? 'IMAP' : 'SMTP';
  return h('fieldset', { class: 'srv srv-' + kind },
    h('legend', {}, h('span', { text: legend }), h('span', { class: 'srv-tag', text: tag })),
    host ? host.el : null,
    h('div', { class: 'srv-row' }, port ? port.el : null, sec ? sec.el : null),
    h('div', { class: 'probe' }, btn, h('p', { class: 'probe-hint', text: 'Vérifie la connexion et le certificat, sans envoyer d’identifiants.' })),
    result);
}

function whitelistAdvice() {
  const mdaemon = callout('', INFO_ICON, 'Avec MDaemon : Dynamic Screening',
    h('p', { text: 'Ouvrez Sécurité › Dynamic Screening, puis ajoutez l’adresse IP de mccs à la liste d’autorisation (« Dynamic Allow List », anciennement « whitelist »). Sinon, Dynamic Screening peut bloquer cette adresse après quelques mots de passe erronés.' }));
  mdaemon.classList.add('adm-callout-sub');
  const node = h('div', { class: 'advice' },
    callout('warn', SHIELD_ICON, 'Ajoutez mccs à la liste blanche de votre serveur mail',
      h('p', { text: 'Pour vérifier le mot de passe de vos clients, le configurateur se connecte à votre serveur mail. Toutes ces connexions viennent de la même adresse IP : celle du serveur qui héberge mccs.' }),
      h('p', { text: 'Ajoutez cette adresse à la liste blanche de la protection contre les attaques par force brute. Sans cela, quelques mots de passe erronés suffisent à faire bloquer mccs : plus aucun client ne peut alors vérifier sa connexion, parfois pendant des heures.' })),
    mdaemon);
  return { node, update: (resolve) => { mdaemon.hidden = resolve('DAV_PRESET') !== 'mdaemon'; } };
}

function davPreview() {
  const title = h('p', { class: 'dav-title' });
  const list = h('div', { class: 'fields dav-list' });
  const note = h('p', { class: 'field-help' });
  const node = h('div', { class: 'dav-pv' }, title, list, note);
  const MDAEMON_ROWS = [['Agenda personnel', 'DAV_CALENDAR_URL_TEMPLATE'], ['Tâches', 'DAV_TASKS_URL_TEMPLATE'], ['Contacts', 'DAV_CONTACTS_URL_TEMPLATE'], ['Compte (découverte)', 'DAV_PRINCIPAL_URL_TEMPLATE']];
  const GENERIC_ROWS = [['Agenda et tâches (CalDAV)', 'DAV_CALENDAR_URL_TEMPLATE'], ['Contacts (CardDAV)', 'DAV_CONTACTS_URL_TEMPLATE']];
  function update(resolve) {
    const email = exampleEmail(resolve('MAIL_HOST'));
    const generic = resolve('DAV_PRESET') === 'generic';
    title.replaceChildren(h('span', { text: 'Aperçu pour ' }), h('strong', { class: 'is-mono', text: email }));
    list.replaceChildren(...(generic ? GENERIC_ROWS : MDAEMON_ROWS).map(([label, key]) => h('div', { class: 'kv' }, h('div', { class: 'kv-main' }, h('span', { class: 'kv-label', text: label }), h('span', { class: 'kv-value', text: davUrl(resolve(key), email) })))));
    note.textContent = generic
      ? 'Les applications du client partent de ces adresses et y trouvent seules ses agendas et carnets d’adresses.'
      : 'Serveur MDaemon : ce sont les adresses que le guide indiquera à ce client, calculées à partir de son adresse e-mail.';
  }
  return { node, update };
}

/* ---------- Détection automatique de l'agenda et des contacts ---------- */
const DAV_URL_KEYS = ['DAV_DISCOVERY_URL', 'DAV_CARD_DISCOVERY_URL'];
const VIA = { dns: 'Trouvé via le DNS (enregistrement SRV).', 'well-known': 'Trouvé via l’adresse standard /.well-known.' };

// Valeur déduite : vide si elle est égale à la valeur par défaut (le réglage continue alors de la suivre).
function setDerived(ctrls, key, value, getResolver) {
  const c = ctrls.get(key);
  if (!c) return;
  c.setValue(value && value !== getResolver().fallback(key) ? value : '');
  c.setError('');
}
// Adresse d'agenda ou de contacts saisie à la main : le type de serveur en est déduit (/webdav/ = MDaemon).
function followManualUrl(ctrls, ctrl, getResolver) {
  if (!ctrl || !DAV_URL_KEYS.includes(ctrl.key) || !ctrl.value.trim()) return;
  setDerived(ctrls, 'DAV_PRESET', presetFor(ctrl.value), getResolver);
}
const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ''; } };
const originOf = (url) => { try { return new URL(url).origin; } catch { return ''; } };

// Bouton « Détecter automatiquement » : interroge /support/api/discover et pré-remplit les adresses.
function davDetect(ctrls, getResolver, onApplied) {
  const where = h('code', {});
  const btn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm probe-btn', text: 'Détecter automatiquement' });
  const result = h('div', { class: 'probe-result', 'aria-live': 'polite' });
  const node = h('div', { class: 'disc' },
    h('div', { class: 'probe' }, btn, h('p', { class: 'probe-hint' }, h('span', { text: 'Cherche l’agenda et les contacts sur ' }), where, h('span', { text: ', sans envoyer d’identifiants.' }))),
    result);
  let adv = null;
  let running = false;
  let lastAuto = '';

  const found = (title, item) => h('div', { class: 'probe-msg is-ok' },
    h('span', { class: 'probe-icon', html: CHECK_ICON }),
    h('div', {}, h('p', { class: 'probe-title', text: title }), h('p', { class: 'disc-url' }, h('code', { text: item.url })), h('p', { class: 'probe-detail', text: VIA[item.via] || '' })));
  const missing = (title, text) => h('div', { class: 'probe-msg is-err' },
    h('span', { class: 'probe-icon', html: WARN_ICON }),
    h('div', {}, h('p', { class: 'probe-title', text: title }), h('p', { text })));

  function apply(d) {
    const any = d.caldav || d.carddav;
    if (d.server === 'mdaemon') {
      // MDaemon : gabarits MDaemon calculés depuis l'URL de base ; seul l'hôte trouvé est repris.
      setDerived(ctrls, 'DAV_PRESET', 'mdaemon', getResolver);
      const o = any ? originOf(any.url) : '';
      if (o && o !== originOf(getResolver().resolve('DAV_BASE_URL'))) setDerived(ctrls, 'DAV_BASE_URL', o, getResolver);
      for (const k of DAV_URL_KEYS) setDerived(ctrls, k, '', getResolver);
    } else if (any) {
      setDerived(ctrls, 'DAV_PRESET', 'generic', getResolver);
      if (d.caldav) setDerived(ctrls, 'DAV_DISCOVERY_URL', d.caldav.url, getResolver);
      if (d.carddav) setDerived(ctrls, 'DAV_CARD_DISCOVERY_URL', d.carddav.url, getResolver);
    }
    onApplied();
  }

  function render(d, host) {
    const rows = [];
    if (d.caldav) rows.push(found('Agenda trouvé', d.caldav));
    if (d.carddav) rows.push(found('Contacts trouvés', d.carddav));
    if (!d.caldav && !d.carddav) {
      rows.push(missing('Rien trouvé', `Aucun agenda ni carnet d’adresses ne répond sur ${host}. Saisissez les adresses à la main dans « Avancé » ci-dessous, ou indiquez-y l’adresse du serveur d’agenda s’il est ailleurs, puis relancez la détection.`));
    } else if (!d.caldav) {
      rows.push(missing('Agenda non trouvé', 'Saisissez son adresse à la main dans « Avancé » ci-dessous.'));
    } else if (!d.carddav) {
      rows.push(missing('Contacts non trouvés', 'Saisissez leur adresse à la main dans « Avancé » ci-dessous.'));
    }
    if (d.server === 'mdaemon') rows.push(h('p', { class: 'disc-note', text: 'Serveur MDaemon reconnu : les adresses personnelles de vos clients suivent le modèle MDaemon.' }));
    if (Array.isArray(d.details) && d.details.length) {
      rows.push(h('details', { class: 'disc-log' }, h('summary', { text: 'Détail des vérifications' }), h('ul', {}, d.details.map((t) => h('li', { text: String(t) })))));
    }
    result.replaceChildren(...rows);
    if (adv && (!d.caldav || !d.carddav)) adv.open = true;
  }

  async function run() {
    if (running) return;
    const base = getResolver().resolve('DAV_BASE_URL');
    const host = hostOf(base);
    if (!isHost(host)) {
      result.replaceChildren(missing('Détection impossible', 'Indiquez d’abord le nom de votre serveur mail, ou l’adresse du serveur d’agenda dans « Avancé ».'));
      return;
    }
    running = true;
    lastAuto = host;
    setBusy(btn, true, 'Recherche en cours…');
    result.replaceChildren(h('p', { class: 'probe-wait', text: `Recherche de l’agenda et des contacts sur ${host}…` }));
    const r = await api('POST', '/support/api/discover', { host: base });
    setBusy(btn, false);
    running = false;
    if (r.status === 200 && r.data.ok) { apply(r.data); render(r.data, host); return; }
    const why = r.status === 422 && r.data.errors && r.data.errors.host ? r.data.errors.host : failMessage(r);
    result.replaceChildren(missing('Détection impossible', why));
  }
  btn.addEventListener('click', run);

  return {
    node,
    setAdvanced(el) { adv = el; },
    update(r) { where.textContent = hostOf(r.resolve('DAV_BASE_URL')) || '?'; },
    // Lancement automatique : une fois par serveur, seulement si le serveur mail est renseigné.
    auto() {
      const r = getResolver();
      const host = hostOf(r.resolve('DAV_BASE_URL'));
      if (r.resolve('MAIL_HOST') === DEFAULTS.MAIL_HOST || !host || host === lastAuto || !state.writable) return;
      run();
    },
  };
}

// Affichage lisible d'une valeur (récapitulatif).
function display(key, type, v) {
  if (!v) {
    return { BRAND_LOGO_URL: 'Aucun logo', BRAND_ACCENT: 'Bleu encre (par défaut)', BRAND_BACKGROUND: 'Fond neutre (par défaut)', ALLOWED_DOMAINS: 'Toutes les adresses' }[key] || 'Non affiché';
  }
  if (type === 'security' || type === 'preset') return optionLabel(v);
  if (type === 'background') return v.includes(',') ? 'Dégradé ' + v.replace(',', ' → ') : v.startsWith('#') ? 'Couleur ' + v : 'Image ' + v.split('/').pop();
  if (type === 'domains') return v.split(',').join(', ');
  if (type === 'logo') return v.startsWith('/uploads/') ? 'Image envoyée (' + v.split('/').pop() + ')' : v;
  return v;
}

/* ================= Assistant d'installation ================= */
const STEPS = [
  { short: 'Marque', title: 'Votre marque', lead: 'Le nom, le logo et les couleurs que vos clients verront sur le configurateur.', keys: ['BRAND_NAME', 'BRAND_LOGO_URL', 'BRAND_ACCENT', 'BRAND_BACKGROUND'] },
  { short: 'Serveurs mail', title: 'Vos serveurs mail', lead: 'Les serveurs auxquels les applications de vos clients se connecteront. Testez-les avant de continuer.', keys: ['MAIL_HOST', 'IMAP_HOST', 'IMAP_PORT', 'IMAP_SECURITY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURITY', 'WEBMAIL_URL'] },
  { short: 'Calendrier', title: 'Calendrier et contacts', lead: 'Où les applications synchronisent l’agenda et le carnet d’adresses de vos clients. mccs les cherche lui-même sur votre serveur.', keys: ['DAV_PRESET', 'DAV_BASE_URL', 'DAV_DISCOVERY_URL', 'DAV_CARD_DISCOVERY_URL'] },
  { short: 'Accès et support', title: 'Domaines acceptés et contact support', lead: 'Qui peut utiliser le configurateur, et comment vos clients vous joignent en cas de besoin.', keys: ['ALLOWED_DOMAINS', 'SUPPORT_PHONE', 'SUPPORT_EMAIL', 'SUPPORT_HOURS', 'SUPPORT_ADDRESS'] },
  { short: 'Récapitulatif', title: 'Vérifiez, puis mettez en ligne', lead: 'Rien n’est encore enregistré. « Mettre en ligne » applique ces réglages tout de suite au site client.', keys: [] },
];
const wiz = { step: 0, max: 0, ctrls: new Map(), started: false, finished: false };

function startWizard() {
  const byKey = fieldMap();
  wiz.step = 0; wiz.max = 0; wiz.finished = false; wiz.started = true;
  wiz.ctrls = new Map();
  const root = $('#wizard');
  const getResolver = () => resolver(entries(wiz.ctrls));
  const onChange = (c) => { followManualUrl(wiz.ctrls, c, getResolver); paintWizard(); };
  for (const s of STEPS) for (const k of s.keys) {
    const f = byKey.get(k);
    if (!f) continue;
    const c = createControl(f, { onChange, upload });
    if (!state.writable) c.setReadOnly(true);
    wiz.ctrls.set(k, c);
  }
  const C = (k) => (wiz.ctrls.get(k) ? wiz.ctrls.get(k).el : null);
  const resolve = () => resolver(entries(wiz.ctrls)).resolve;

  wiz.preview = brandPreview();
  wiz.dav = davPreview();
  wiz.detect = davDetect(wiz.ctrls, getResolver, () => paintWizard());
  const davAdv = h('details', { class: 'adv' },
    h('summary', {}, h('span', { text: 'Avancé' }), h('span', { class: 'adv-hint', text: ' : adresses à saisir ou corriger à la main' })),
    h('div', { class: 'adv-body' }, C('DAV_BASE_URL'), C('DAV_DISCOVERY_URL'), C('DAV_CARD_DISCOVERY_URL')));
  wiz.detect.setAdvanced(davAdv);
  wiz.advice = whitelistAdvice();
  wiz.recap = h('div', { class: 'recap' });
  wiz.banner = h('div', { class: 'wiz-banner', hidden: true });

  const bodies = [
    h('div', { class: 'wiz-brand' }, h('div', { class: 'wiz-col' }, C('BRAND_NAME'), C('BRAND_LOGO_URL'), C('BRAND_ACCENT'), C('BRAND_BACKGROUND')), h('div', { class: 'wiz-aside' }, wiz.preview.node)),
    h('div', {}, C('MAIL_HOST'), h('div', { class: 'srv-grid' }, serverBlock('imap', wiz.ctrls, resolve), serverBlock('smtp', wiz.ctrls, resolve)), C('WEBMAIL_URL'), wiz.advice.node),
    h('div', {}, wiz.detect.node, wiz.dav.node, davAdv),
    h('div', {}, C('ALLOWED_DOMAINS'), h('h3', { class: 'wiz-sub', text: 'Contact support' }), h('p', { class: 'wiz-sub-lead', text: 'Affiché à vos clients s’ils ont besoin d’aide. Tout est facultatif : un champ vide n’apparaît pas.' }), h('div', { class: 'grid-2' }, C('SUPPORT_PHONE'), C('SUPPORT_EMAIL'), C('SUPPORT_HOURS'), C('SUPPORT_ADDRESS'))),
    h('div', {}, wiz.banner, wiz.recap),
  ];
  wiz.panels = STEPS.map((s, i) => h('section', { class: 'wiz-step', 'aria-labelledby': 'wiz-h-' + i, hidden: true },
    h('h2', { id: 'wiz-h-' + i, tabindex: '-1', text: s.title }),
    h('p', { class: 'wiz-lead', text: s.lead }),
    bodies[i]));

  wiz.stepper = h('ol', { class: 'stepper adm-stepper', 'aria-label': 'Étapes de l’assistant' }, STEPS.map((s, i) => h('li', {},
    h('a', { onclick: (e) => { e.preventDefault(); if (i <= wiz.max) goStep(i, true); } }, h('span', { text: String(i + 1) }), h('em', { text: s.short })))));
  wiz.back = h('button', { type: 'button', class: 'btn btn-ghost', text: 'Retour', onclick: () => goStep(wiz.step - 1, true) });
  wiz.next = h('button', { type: 'submit', class: 'btn btn-primary wiz-next' });
  const form = h('form', { class: 'card wiz-card', novalidate: true }, ...wiz.panels, h('div', { class: 'wiz-nav' }, wiz.back, wiz.next));
  form.addEventListener('submit', (e) => { e.preventDefault(); if (wiz.step === STEPS.length - 1) publish(); else if (validateStep(wiz.step)) goStep(wiz.step + 1, true); });

  const intro = state.setupDone
    ? 'Les valeurs actuelles sont déjà en place. Changez ce qui doit l’être : rien n’est enregistré avant la dernière étape.'
    : 'Bienvenue ! Cinq étapes pour préparer votre configurateur. Les champs laissés vides gardent la valeur indiquée en gris. Rien n’est enregistré avant la dernière étape.';
  root.replaceChildren(...[
    h('div', { class: 'view-head' }, h('h1', { text: 'Assistant d’installation' }), h('p', { text: intro })),
    state.writable ? null : readonlyBanner(),
    wiz.stepper,
    form].filter(Boolean));
  goStep(0, false);
}

function paintWizard() {
  const r = applyHints(wiz.ctrls);
  wiz.preview.update(r.resolve, (fieldMap().get('BRAND_LOGO_URL') || {}).effective);
  wiz.dav.update(r.resolve);
  wiz.detect.update(r);
  wiz.advice.update(r.resolve);
  return r;
}

function validateStep(i) {
  let first = null;
  for (const k of STEPS[i].keys) {
    const c = wiz.ctrls.get(k);
    if (c && !c.validate() && !first) first = c;
  }
  if (first) first.focus();
  return !first;
}

function goStep(i, focus) {
  if (i < 0 || i >= STEPS.length) return;
  wiz.step = i;
  wiz.max = Math.max(wiz.max, i);
  wiz.panels.forEach((p, j) => { p.hidden = j !== i; });
  [...wiz.stepper.children].forEach((li, j) => {
    li.classList.toggle('current', j === i);
    li.classList.toggle('done', j < i || (j <= wiz.max && j !== i));
    const a = li.firstElementChild;
    if (j <= wiz.max && j !== i) a.setAttribute('href', '#assistant'); else a.removeAttribute('href');
    if (j === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
  });
  wiz.back.hidden = i === 0;
  const last = i === STEPS.length - 1;
  wiz.next.textContent = last ? 'Mettre en ligne' : 'Continuer';
  wiz.next.disabled = last && !state.writable;
  const r = paintWizard();
  if (last) renderRecap(r.resolve);
  if (STEPS[i].keys.includes('DAV_DISCOVERY_URL')) wiz.detect.auto();
  if (focus) {
    $('#wiz-h-' + i).focus({ preventScroll: true });
    wiz.stepper.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

function renderRecap(resolve) {
  const changed = [...wiz.ctrls.values()].filter((c) => c.isDirty());
  const n = changed.length;
  const summary = n
    ? `${n} réglage${n > 1 ? 's' : ''} modifié${n > 1 ? 's' : ''} ser${n > 1 ? 'ont' : 'a'} enregistré${n > 1 ? 's' : ''}.`
    : 'Vous n’avez rien modifié : « Mettre en ligne » confirme les réglages actuels.';
  wiz.recap.replaceChildren(
    h('p', { class: 'recap-summary', text: summary }),
    ...STEPS.slice(0, -1).map((s, i) => h('div', { class: 'recap-group' },
      h('div', { class: 'recap-head' }, h('h3', { text: s.title }), h('button', { type: 'button', class: 'link-btn', text: 'Modifier', 'aria-label': 'Modifier : ' + s.title, onclick: () => goStep(i, true) })),
      h('dl', { class: 'recap-list' }, s.keys.filter((k) => wiz.ctrls.has(k)).map((k) => {
        const c = wiz.ctrls.get(k);
        const v = resolve(k);
        return h('div', { class: 'recap-row' + (c.isDirty() ? ' is-changed' : '') },
          h('dt', { text: c.field.label }),
          h('dd', {}, h('span', { class: ['host', 'port', 'url', 'domains', 'email'].includes(c.field.type) ? 'is-mono' : '', text: display(k, c.field.type, v) }), c.isDirty() ? h('span', { class: 'src src-pending', text: 'modifié' }) : null));
      })))));
}

function showWizardErrors(errors) {
  const list = Object.entries(errors || {});
  let target = -1;
  const loose = [];
  for (const [k, msg] of list) {
    const c = wiz.ctrls.get(k);
    if (!c) { loose.push(k === '_' ? msg : `${k} : ${msg}`); continue; }
    c.setError(msg);
    const i = STEPS.findIndex((s) => s.keys.includes(k));
    if (target < 0 || i < target) target = i;
  }
  wiz.banner.hidden = !loose.length;
  wiz.banner.replaceChildren(...(loose.length ? [callout('warn', WARN_ICON, 'Les réglages n’ont pas été enregistrés', ...loose.map((m) => h('p', { text: m })))] : []));
  if (target >= 0) {
    goStep(target, true);
    const first = STEPS[target].keys.map((k) => wiz.ctrls.get(k)).find((c) => c && c.el.classList.contains('has-error'));
    if (first) first.focus();
  }
}

async function publish() {
  for (let i = 0; i < STEPS.length - 1; i++) if (!validateStep(i)) { goStep(i, true); validateStep(i); return; }
  const values = {};
  for (const c of wiz.ctrls.values()) if (c.isDirty()) values[c.key] = c.value.trim();
  setBusy(wiz.next, true, 'Mise en ligne…');
  wiz.banner.hidden = true;
  if (Object.keys(values).length) {
    const r = await api('PUT', '/support/api/settings', { values });
    if (r.status !== 200 || !r.data.ok) {
      setBusy(wiz.next, false);
      if (r.data && r.data.errors) showWizardErrors(r.data.errors);
      else showWizardErrors({ _: failMessage(r) });
      return;
    }
    if (Array.isArray(r.data.fields)) state.fields = r.data.fields;
  }
  const d = await api('POST', '/support/api/setup-done');
  setBusy(wiz.next, false);
  if (d.status !== 200) { showWizardErrors({ _: 'Les réglages sont enregistrés, mais l’installation n’a pas pu être marquée comme terminée. ' + failMessage(d) }); return; }
  state.setupDone = true;
  wiz.finished = true;
  rebuildSettings();
  reloadConfig();
  reloadBrandCss();
  showWizardDone();
  toast('Réglages mis en ligne.');
}

function showWizardDone() {
  $('#wizard').replaceChildren(h('div', { class: 'card wiz-done' },
    h('span', { class: 'done-icon', html: CHECK_ICON }),
    h('h1', { tabindex: '-1', text: 'Votre configurateur est en ligne' }),
    h('p', { class: 'done-lead', text: 'Les réglages s’appliquent dès maintenant au site client. Vous pourrez les ajuster à tout moment dans l’onglet Réglages.' }),
    h('div', { class: 'wiz-done-actions' },
      h('a', { class: 'btn btn-primary', href: '/', target: '_blank', rel: 'noopener', text: 'Voir le site client' }),
      h('a', { class: 'btn btn-ghost', href: '#liens', text: 'Créer un lien client' }),
      h('a', { class: 'btn btn-ghost', href: '#reglages', text: 'Ouvrir les réglages' }))));
  scrollTo({ top: 0 });
  $('#wizard h1').focus({ preventScroll: true });
}

/* ================= Réglages ================= */
const SECTIONS = [
  { group: 'brand', title: 'Marque', lead: 'Le nom, le logo et les couleurs de la page que voient vos clients.' },
  { group: 'servers', title: 'Serveurs mail', lead: 'Les serveurs auxquels les applications de vos clients se connectent, et les adresses autorisées.' },
  { group: 'dav', title: 'Calendrier et contacts', lead: 'Les adresses de synchronisation de l’agenda (CalDAV) et des contacts (CardDAV), détectées sur votre serveur.' },
  { group: 'public', title: 'Adresse publique', lead: 'L’adresse de ce configurateur, utilisée dans les liens et QR codes envoyés à vos clients.' },
  { group: 'support', title: 'Contact support', lead: 'Les coordonnées montrées à vos clients s’ils ont besoin d’aide. Tout est facultatif : un champ vide n’apparaît pas.' },
  { group: 'profile', title: 'Profil Apple', lead: 'Le profil installe d’un coup la messagerie, l’agenda et les contacts sur iPhone, iPad et Mac.' },
];
const set = { ctrls: new Map(), sections: [], updaters: [] };

function readonlyBanner() {
  return callout('warn', WARN_ICON, 'Les réglages ne peuvent pas être enregistrés',
    h('p', {}, 'Le dossier de données ', h('code', { text: '/data' }), ' n’est pas accessible en écriture : les champs sont en lecture seule et le site utilise les valeurs du fichier .env.'),
    h('p', {}, 'Pour corriger, montez un volume sur ', h('code', { text: '/data' }), ' (dans docker-compose.yml : ', h('code', { text: 'volumes: - mccs-data:/data' }), '), puis relancez le conteneur avec ', h('code', { class: 'nowrap', text: 'docker compose up -d' }), '.'));
}

function rebuildSettings() {
  const root = $('#settings');
  const byGroup = new Map();
  for (const f of state.fields) {
    if (!byGroup.has(f.group)) byGroup.set(f.group, []);
    byGroup.get(f.group).push(f);
  }
  const sections = SECTIONS.filter((s) => byGroup.has(s.group));
  for (const g of byGroup.keys()) if (!SECTIONS.some((s) => s.group === g)) sections.push({ group: g, title: 'Autres réglages', lead: '' });

  set.ctrls = new Map();
  set.sections = [];
  set.updaters = [];
  const getResolver = () => resolver(entries(set.ctrls));
  const resolve = () => getResolver().resolve;
  for (const f of state.fields) {
    const c = createControl(f, { meta: true, upload, onChange: (ctrl) => { followManualUrl(set.ctrls, ctrl, getResolver); paintSettings(); }, onReset: resetField });
    if (!state.writable) c.setReadOnly(true);
    set.ctrls.set(f.key, c);
  }

  const cards = sections.map((s) => {
    const keys = byGroup.get(s.group).map((f) => f.key);
    const used = new Set();
    const take = (k) => { const c = set.ctrls.get(k); if (!c || used.has(k) || !keys.includes(k)) return null; used.add(k); return c.el; };
    let body;
    if (s.group === 'brand') {
      const pv = brandPreview();
      set.updaters.push((r) => pv.update(r.resolve, (fieldMap().get('BRAND_LOGO_URL') || {}).effective));
      body = h('div', { class: 'set-brand' }, h('div', { class: 'wiz-col' }, take('BRAND_NAME'), take('BRAND_LOGO_URL'), take('BRAND_ACCENT'), take('BRAND_BACKGROUND'), keys.map(take)), h('div', { class: 'wiz-aside' }, pv.node));
    } else if (s.group === 'servers') {
      ['IMAP_HOST', 'IMAP_PORT', 'IMAP_SECURITY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURITY'].forEach((k) => used.add(k));
      body = h('div', {}, take('MAIL_HOST'), h('div', { class: 'srv-grid' }, serverBlock('imap', set.ctrls, resolve), serverBlock('smtp', set.ctrls, resolve)), take('WEBMAIL_URL'), take('ALLOWED_DOMAINS'), keys.map(take));
    } else if (s.group === 'dav') {
      const pv = davPreview();
      const det = davDetect(set.ctrls, getResolver, () => paintSettings());
      set.updaters.push((r) => { pv.update(r.resolve); det.update(r); });
      // Le type de serveur est déduit par la détection : jamais affiché comme une liste.
      used.add('DAV_PRESET');
      const first = ['DAV_BASE_URL', ...DAV_URL_KEYS].map(take);
      const rest = keys.map(take).filter(Boolean);
      const adv = h('details', { class: 'adv' },
        h('summary', {}, h('span', { text: 'Avancé' }), h('span', { class: 'adv-hint', text: ' : adresses à saisir ou corriger à la main' })),
        h('div', { class: 'adv-body' }, first, rest));
      det.setAdvanced(adv);
      body = h('div', {}, det.node, pv.node, adv);
    } else if (s.group === 'support') {
      body = h('div', { class: 'grid-2' }, keys.map(take));
    } else {
      body = h('div', {}, keys.map(take));
    }
    const status = h('p', { class: 'set-status', 'aria-live': 'polite' });
    const save = h('button', { type: 'button', class: 'btn btn-primary set-save', text: 'Enregistrer' });
    const err = h('div', { class: 'set-error', hidden: true });
    const sec = { group: s.group, keys, status, save, err };
    save.addEventListener('click', () => saveSection(sec));
    set.sections.push(sec);
    return h('section', { class: 'card set-sec', id: 'sec-' + s.group, 'aria-labelledby': 'sec-h-' + s.group },
      h('header', { class: 'set-head' }, h('h2', { id: 'sec-h-' + s.group, text: s.title }), s.lead ? h('p', { text: s.lead }) : null),
      body, err,
      state.writable ? h('div', { class: 'set-foot' }, status, save) : null);
  });

  const restore = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', html: ICONS.undo + '<span>Annuler la dernière modification</span>', onclick: () => $('#dlg-restore').showModal() });
  const relaunch = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Relancer l’assistant', onclick: () => { startWizard(); location.hash = '#assistant'; } });
  const banners = [];
  if (!state.writable) banners.push(readonlyBanner());
  if (state.passwordFromEnv) {
    banners.push(callout('', INFO_ICON, 'Choisissez votre propre mot de passe',
      h('p', {}, 'Vous vous connectez avec le mot de passe du fichier .env. Remplacez-le par un mot de passe propre à cet espace. ',
        h('button', { type: 'button', class: 'link-inline', text: 'Changer le mot de passe', onclick: openPassword }))));
  }
  root.replaceChildren(
    h('div', { class: 'view-head set-top' },
      h('div', {}, h('h1', { text: 'Réglages' }), h('p', { text: 'Chaque section s’enregistre séparément et s’applique tout de suite au site client, sans redémarrage.' })),
      h('div', { class: 'set-actions' }, relaunch, state.writable ? restore : null)),
    h('div', { class: 'set-layout' },
      h('nav', { class: 'set-nav', 'aria-label': 'Sections des réglages' }, h('ul', {}, sections.map((s) => h('li', {}, h('a', { href: '#sec-' + s.group, 'data-sec': s.group, text: s.title, onclick: (e) => { e.preventDefault(); $('#sec-' + s.group).scrollIntoView({ behavior: 'smooth', block: 'start' }); } }))))),
      h('div', { class: 'set-main' }, banners.length ? h('div', { class: 'set-banners' }, banners) : null, cards)));
  paintSettings();
}

function paintSettings() {
  const r = applyHints(set.ctrls);
  set.updaters.forEach((fn) => fn(r));
  for (const sec of set.sections) {
    const n = sec.keys.filter((k) => set.ctrls.get(k).isDirty()).length;
    sec.status.textContent = n ? `${n} modification${n > 1 ? 's' : ''} non enregistrée${n > 1 ? 's' : ''}` : 'Aucune modification';
    sec.status.classList.toggle('is-dirty', n > 0);
    sec.save.disabled = n === 0 || sec.save.classList.contains('is-busy');
    const link = document.querySelector(`.set-nav a[data-sec="${sec.group}"]`);
    if (link) link.classList.toggle('is-dirty', n > 0);
  }
}

// Met à jour les contrôles depuis une nouvelle liste de champs (les saisies en cours sont gardées, sauf force).
function applyFields(fields, force = false) {
  state.fields = fields;
  const byKey = fieldMap();
  for (const c of set.ctrls.values()) { const f = byKey.get(c.key); if (f) c.setField(f, { force }); }
  paintSettings();
}

function showErrors(sec, errors) {
  let first = null;
  const loose = [];
  for (const [k, msg] of Object.entries(errors || {})) {
    const c = set.ctrls.get(k);
    if (c) { c.setError(msg); if (!first) first = c; } else loose.push(k === '_' ? msg : `${k} : ${msg}`);
  }
  sec.err.hidden = !loose.length;
  sec.err.replaceChildren(...loose.map((m) => h('p', { class: 'field-error', text: m })));
  if (first) first.focus();
}

async function saveSection(sec) {
  const dirty = sec.keys.map((k) => set.ctrls.get(k)).filter((c) => c.isDirty());
  if (!dirty.length) return;
  const invalid = dirty.filter((c) => !c.validate());
  if (invalid.length) { invalid[0].focus(); return; }
  const values = Object.fromEntries(dirty.map((c) => [c.key, c.value.trim()]));
  setBusy(sec.save, true, 'Enregistrement…');
  sec.err.hidden = true;
  const r = await api('PUT', '/support/api/settings', { values });
  setBusy(sec.save, false);
  if (r.status === 200 && r.data.ok && Array.isArray(r.data.fields)) {
    applyFields(r.data.fields);
    toast('Réglages enregistrés.');
    afterChange();
  } else {
    showErrors(sec, (r.data && r.data.errors) || { _: failMessage(r) });
    paintSettings();
  }
}

async function resetField(ctrl) {
  const sec = set.sections.find((s) => s.keys.includes(ctrl.key));
  const r = await api('PUT', '/support/api/settings', { values: { [ctrl.key]: '' } });
  if (r.status === 200 && r.data.ok && Array.isArray(r.data.fields)) {
    state.fields = r.data.fields;
    const f = fieldMap().get(ctrl.key);
    if (f) ctrl.setField(f, { force: true });
    applyFields(r.data.fields);
    toast(`${ctrl.field.label} : valeur par défaut rétablie.`);
    afterChange();
  } else if (sec) showErrors(sec, (r.data && r.data.errors) || { _: failMessage(r) });
}

async function restorePrevious() {
  const btn = $('#restore-confirm');
  setBusy(btn, true);
  const r = await api('POST', '/support/api/settings/restore');
  setBusy(btn, false);
  $('#dlg-restore').close();
  if (r.status === 200 && r.data.ok && Array.isArray(r.data.fields)) {
    applyFields(r.data.fields, true);
    toast('Dernière modification annulée.');
    afterChange();
  } else if (r.status === 409) toast('Rien à annuler : aucune version précédente n’est enregistrée.');
  else toast(failMessage(r));
}

// Le nom et le logo de l'en-tête, et l'adresse des liens clients, suivent les réglages enregistrés.
function reloadBrandCss() {
  const link = document.querySelector('link[href^="/brand.css"]');
  if (link) link.href = '/brand.css?r=' + Date.now();
}
function afterChange() {
  reloadConfig();
  reloadBrandCss();
  wiz.started = false; // l'assistant repartira des nouvelles valeurs
}

/* ================= Compte : menu, mot de passe, déconnexion ================= */
function initAccount() {
  const btn = $('#acct-btn');
  const menu = $('#acct-menu');
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('.acct-item:not([hidden])').focus();
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.acct')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
  $('#acct-password').addEventListener('click', () => { close(); openPassword(); });
  $('#acct-logout').addEventListener('click', async () => {
    await api('POST', '/support/api/logout');
    location.href = '/support/login.html';
  });

  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === d) d.close(); });
  }
  $('#restore-confirm').addEventListener('click', restorePrevious);
  $('#pw-form').addEventListener('submit', (e) => { e.preventDefault(); changePassword(); });
}

function pwError(id, msg) {
  const el = $('#' + id + '-error');
  el.textContent = msg || '';
  el.hidden = !msg;
  $('#' + id).setAttribute('aria-invalid', msg ? 'true' : 'false');
}
function openPassword() {
  const d = $('#dlg-password');
  for (const id of ['pw-current', 'pw-next', 'pw-confirm']) { $('#' + id).value = ''; pwError(id, ''); }
  $('#pw-env').hidden = !state.passwordFromEnv;
  d.showModal();
  $('#pw-current').focus();
}
async function changePassword() {
  const current = $('#pw-current').value;
  const next = $('#pw-next').value;
  const confirm = $('#pw-confirm').value;
  pwError('pw-current', current ? '' : 'Saisissez votre mot de passe actuel.');
  pwError('pw-next', next.length >= 12 ? '' : `Le nouveau mot de passe doit contenir au moins 12 caractères (${next.length} pour l’instant).`);
  pwError('pw-confirm', confirm === next ? '' : 'Les deux mots de passe ne sont pas identiques.');
  const bad = ['pw-current', 'pw-next', 'pw-confirm'].find((id) => !$('#' + id + '-error').hidden);
  if (bad) { $('#' + bad).focus(); return; }
  const btn = $('#pw-submit');
  setBusy(btn, true, 'Changement…');
  const r = await api('POST', '/support/api/password', { current, next });
  setBusy(btn, false);
  if (r.status === 200 && r.data.ok) {
    $('#dlg-password').close();
    state.passwordFromEnv = false;
    rebuildSettings();
    toast('Mot de passe changé.');
  } else if (r.status === 401) { pwError('pw-current', 'Mot de passe actuel incorrect.'); $('#pw-current').focus(); }
  else if (r.status === 422) { pwError('pw-next', 'Le nouveau mot de passe doit contenir au moins 12 caractères.'); $('#pw-next').focus(); }
  else if (r.status === 429) { pwError('pw-current', failMessage(r)); }
  else pwError('pw-current', failMessage(r));
}

/* ================= Navigation entre les vues ================= */
const VIEWS = ['assistant', 'reglages', 'liens'];
function route() {
  const v = location.hash.slice(1);
  if (v.startsWith('sec-')) return; // ancre interne aux réglages
  const view = VIEWS.includes(v) ? v : state.setupDone ? 'liens' : 'assistant';
  for (const id of VIEWS) $('#view-' + id).hidden = id !== view;
  for (const a of document.querySelectorAll('.adm-tabs a')) {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (view === 'assistant' && (!wiz.started || wiz.finished)) startWizard();
  scrollTo({ top: 0 });
}

async function init() {
  initAccount();
  initLinks();
  const r = await api('GET', '/support/api/state');
  if (r.status !== 200 || !Array.isArray(r.data.fields)) {
    $('#adm-loading').textContent = 'Impossible de charger les réglages. ' + failMessage(r);
    return;
  }
  state = r.data;
  $('#adm-loading').hidden = true;
  document.body.classList.toggle('is-readonly', !state.writable);
  rebuildSettings();
  if (!state.setupDone) history.replaceState(null, '', '#assistant');
  route();
  addEventListener('hashchange', route);
}

init();
