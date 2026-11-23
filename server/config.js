'use strict';

// Configuration : valeurs intégrées, puis variables d'environnement, puis réglages modifiés
// dans l'admin (/data/config.json, indexés par nom de variable). Le fichier gagne.
const { FIELDS, validateValues, PHONE_EXT_RE } = require('./settings');
const { createStore } = require('./store');
const { buildMessages, effectiveMessage } = require('./messages');

function httpUrl(v) {
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.origin + u.pathname.replace(/\/+$/, '');
  } catch { /* défaut ci-dessous */ }
  return '';
}

// Remplace {email}, {local} et {domain} dans un gabarit d'URL DAV (même logique que app.js).
function davUrl(template, email) {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  const enc = (s) => encodeURIComponent(s).replace(/%40/g, '@');
  return template.replace(/\{email\}/g, enc(local + '@' + domain)).replace(/\{local\}/g, enc(local)).replace(/\{domain\}/g, enc(domain));
}

// Lien tel: (RFC 3966) d'un numéro déjà validé : chiffres et + de tête, poste en « ;ext= ».
function telUri(phone) {
  const v = String(phone || '').trim();
  if (!v) return '';
  const ext = PHONE_EXT_RE.exec(v);
  const main = ext ? v.slice(0, ext.index) : v;
  const number = (main.trim().startsWith('+') ? '+' : '') + main.replace(/\D/g, '');
  return 'tel:' + number + (ext ? ';ext=' + ext[0].replace(/\D/g, '') : '');
}

// Couleur d'accent : uniquement #rgb ou #rrggbb (injectée dans /brand.css).
function color(v, def) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v || '') ? v : def;
}
// Logo : chemin local (/img/…) ou URL http(s) absolue ; vide = logo texte + icône neutre.
function logoUrl(v) {
  if (!v) return '';
  if (/^\/[^/\\]/.test(v)) return v;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
  } catch { /* ignoré */ }
  return '';
}

// Fond de page (BRAND_BACKGROUND) : déjà validé par settings.js, ignoré sinon.
function background(v) {
  return validateValues({ BRAND_BACKGROUND: v }).BRAND_BACKGROUND ? '' : v.trim();
}

// Calcule la configuration effective à partir d'une source clé → valeur (env + réglages).
function build(src) {
  const env = (name, def) => {
    const v = src[name];
    return v === undefined || v === '' ? def : v;
  };
  const bool = (name) => /^(1|true|on|yes|oui)$/i.test(String(env(name, '')).trim());
  const count = (name, def) => {
    const v = String(env(name, String(def))).trim();
    return /^\d{1,5}$/.test(v) && +v >= 1 && +v <= 10000 ? +v : def;
  };
  const int = (name, def) => {
    const n = parseInt(env(name, String(def)), 10);
    return Number.isFinite(n) && n > 0 && n < 65536 ? n : def;
  };

  // Type de serveur DAV, déduit par la découverte de l'admin (server/discover.js) ou fixé dans le .env.
  // « mdaemon » (défaut, inchangé) : chemins /webdav/… et collections b64=… de MDaemon.
  // « generic » : tout serveur CalDAV/CardDAV conforme ; les applications partent des URL de découverte
  // (DAV_DISCOVERY_URL et DAV_CARD_DISCOVERY_URL, /.well-known/… par défaut) et trouvent le reste seules.
  const PRESET = env('DAV_PRESET', 'mdaemon').toLowerCase() === 'generic' ? 'generic' : 'mdaemon';
  const MAIL_HOST = env('MAIL_HOST', 'mail.example.com');
  const DAV_BASE = env('DAV_BASE_URL', 'https://' + MAIL_HOST).replace(/\/+$/, '');
  const DISCOVERY = env('DAV_DISCOVERY_URL', DAV_BASE + '/.well-known/caldav');
  const CARD_DISCOVERY = env('DAV_CARD_DISCOVERY_URL', DAV_BASE + '/.well-known/carddav');
  const PRESETS = {
    mdaemon: {
      caldavUrl: DAV_BASE + '/webdav/calendar',
      carddavUrl: DAV_BASE + '/webdav/addressbook',
      tasksUrl: DAV_BASE + '/webdav/tasklist',
      principal: DAV_BASE + '/webdav/principals/{email}/',
      calendar: DAV_BASE + '/webdav/caldav/{domain}/{local}/b64=Q2FsZW5kYXI/',
      tasks: DAV_BASE + '/webdav/caldav/{domain}/{local}/b64=VGFza3M/',
      contacts: DAV_BASE + '/webdav/carddav/{domain}/{local}/b64=Q29udGFjdHM/',
    },
    generic: {
      caldavUrl: DISCOVERY,
      carddavUrl: CARD_DISCOVERY,
      tasksUrl: DISCOVERY,
      principal: DISCOVERY,
      calendar: DISCOVERY,
      tasks: DISCOVERY,
      contacts: CARD_DISCOVERY,
    },
  };
  const P = PRESETS[PRESET];

  const BRAND = env('BRAND_NAME', 'mccs');

  return {
    port: int('PORT', 8080),
    brand: BRAND,
    brandLogoUrl: logoUrl(env('BRAND_LOGO_URL', '')),
    brandAccent: color(env('BRAND_ACCENT', ''), ''),
    brandBackground: background(env('BRAND_BACKGROUND', '')),
    // En-tête qui donne l'IP du client derrière un proxy de confiance (vide = adresse de la connexion).
    trustedProxyHeader: env('TRUSTED_PROXY_HEADER', '').toLowerCase(),
    davPreset: PRESET,
    mailHost: MAIL_HOST,
    davBaseUrl: DAV_BASE,
    imap: {
      host: env('IMAP_HOST', MAIL_HOST),
      port: int('IMAP_PORT', 993),
      security: env('IMAP_SECURITY', 'SSL/TLS'),
    },
    smtp: {
      host: env('SMTP_HOST', MAIL_HOST),
      port: int('SMTP_PORT', 465),
      security: env('SMTP_SECURITY', 'SSL/TLS'),
    },
    // Alias affichés tant qu'aucune adresse n'est saisie (l'utilisateur est déduit de l'authentification).
    caldavUrl: env('CALDAV_URL', P.caldavUrl),
    carddavUrl: env('CARDDAV_URL', P.carddavUrl),
    tasksUrl: env('TASKS_URL', P.tasksUrl),
    // URL de découverte (.well-known) : DAVx5, bouton de découverte de CalDAV Synchronizer.
    davDiscoveryUrl: DISCOVERY,
    davCardDiscoveryUrl: CARD_DISCOVERY,
    // Gabarits des URL personnelles, dérivées de l'adresse saisie.
    // Variables : {email} (adresse complète), {local} (partie avant @), {domain}.
    davTemplates: {
      principal: env('DAV_PRINCIPAL_URL_TEMPLATE', P.principal),
      calendar: env('DAV_CALENDAR_URL_TEMPLATE', P.calendar),
      tasks: env('DAV_TASKS_URL_TEMPLATE', P.tasks),
      contacts: env('DAV_CONTACTS_URL_TEMPLATE', P.contacts),
    },
    webmailUrl: env('WEBMAIL_URL', 'https://' + MAIL_HOST + '/'),
    // Domaines e-mail acceptés par le test de connexion (vide = tous).
    allowedDomains: env('ALLOWED_DOMAINS', '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
    // Vérification du mot de passe par le client (POST /api/test) : désactivée par défaut.
    connectionTest: bool('CONNECTION_TEST'),
    // Essais permis par fenêtre de 15 minutes, comptés avant la connexion au serveur mail.
    connectionTestLimits: {
      perEmail: count('CONNECTION_TEST_MAX_PER_EMAIL', 5),
      perIp: count('CONNECTION_TEST_MAX_PER_IP', 20),
    },
    // Messages montrés au client selon le résultat du test (server/messages.js).
    testMessages: buildMessages(env),
    // Adresse publique du configurateur (liens et QR codes envoyés aux clients).
    publicUrl: httpUrl(env('PUBLIC_URL', '')),
    // Page interne /support (désactivée si SUPPORT_PASSWORD est vide).
    supportAuth: {
      user: env('SUPPORT_USER', 'support'),
      password: env('SUPPORT_PASSWORD', ''),
    },
    // Coordonnées du support : toutes facultatives (vide = masqué).
    support: {
      email: env('SUPPORT_EMAIL', ''),
      phone: env('SUPPORT_PHONE', ''),
      hours: env('SUPPORT_HOURS', ''),
      address: env('SUPPORT_ADDRESS', ''),
    },
    profile: {
      org: env('PROFILE_ORGANIZATION', BRAND),
      idPrefix: env('PROFILE_ID_PREFIX', 'com.example.mailsetup'),
    },
    links: {
      caldavSynchronizer: env('CALDAVSYNC_URL', 'https://caldavsynchronizer.org/download-2/'),
      davx5Github: env('DAVX5_GITHUB_URL', 'https://github.com/bitfireAT/davx5-ose/releases'),
      davx5Fdroid: env('DAVX5_FDROID_URL', 'https://f-droid.org/packages/at.bitfire.davdroid/'),
      davx5Play: env('DAVX5_PLAY_URL', 'https://play.google.com/store/apps/details?id=at.bitfire.davdroid'),
      thunderbird: env('THUNDERBIRD_URL', 'https://www.thunderbird.net/fr/'),
    },
  };
}

// Valeur effective de chaque réglage (affichée dans l'admin à côté de la valeur saisie).
const EFFECTIVE = {
  BRAND_NAME: (c) => c.brand, BRAND_LOGO_URL: (c) => c.brandLogoUrl, BRAND_ACCENT: (c) => c.brandAccent,
  BRAND_BACKGROUND: (c) => c.brandBackground, MAIL_HOST: (c) => c.mailHost,
  IMAP_HOST: (c) => c.imap.host, IMAP_PORT: (c) => String(c.imap.port), IMAP_SECURITY: (c) => c.imap.security,
  SMTP_HOST: (c) => c.smtp.host, SMTP_PORT: (c) => String(c.smtp.port), SMTP_SECURITY: (c) => c.smtp.security,
  WEBMAIL_URL: (c) => c.webmailUrl, ALLOWED_DOMAINS: (c) => c.allowedDomains.join(', '), DAV_PRESET: (c) => c.davPreset, DAV_BASE_URL: (c) => c.davBaseUrl,
  CALDAV_URL: (c) => c.caldavUrl, CARDDAV_URL: (c) => c.carddavUrl, TASKS_URL: (c) => c.tasksUrl,
  DAV_DISCOVERY_URL: (c) => c.davDiscoveryUrl, DAV_CARD_DISCOVERY_URL: (c) => c.davCardDiscoveryUrl,
  DAV_PRINCIPAL_URL_TEMPLATE: (c) => c.davTemplates.principal, DAV_CALENDAR_URL_TEMPLATE: (c) => c.davTemplates.calendar,
  DAV_TASKS_URL_TEMPLATE: (c) => c.davTemplates.tasks, DAV_CONTACTS_URL_TEMPLATE: (c) => c.davTemplates.contacts,
  PUBLIC_URL: (c) => c.publicUrl, SUPPORT_PHONE: (c) => c.support.phone, SUPPORT_EMAIL: (c) => c.support.email,
  SUPPORT_HOURS: (c) => c.support.hours, SUPPORT_ADDRESS: (c) => c.support.address,
  PROFILE_ORGANIZATION: (c) => c.profile.org, PROFILE_ID_PREFIX: (c) => c.profile.idPrefix,
  CONNECTION_TEST: (c) => String(c.connectionTest),
  CONNECTION_TEST_MAX_PER_EMAIL: (c) => String(c.connectionTestLimits.perEmail),
  CONNECTION_TEST_MAX_PER_IP: (c) => String(c.connectionTestLimits.perIp),
};
for (const f of FIELDS) if (f.type === 'message') EFFECTIVE[f.key] = (c) => effectiveMessage(c.testMessages, f);

// Remplace le contenu de target par celui de next, en gardant les mêmes objets imbriqués
// (les modules qui ont gardé une référence à config ou config.imap voient les nouvelles valeurs).
function replaceInPlace(target, next) {
  for (const k of Object.keys(target)) if (!(k in next)) delete target[k];
  for (const [k, v] of Object.entries(next)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') replaceInPlace(target[k], v);
    else target[k] = v;
  }
  return target;
}

function createSettings({ env, dir }) {
  const store = createStore(dir);
  const listeners = [];
  let raw = {};        // contenu du fichier, y compris les clés inconnues de cette version
  let overrides = {};  // réglages valides, appliqués à la configuration
  const config = {};

  function reload() {
    // Les clés inconnues ou invalides du fichier sont ignorées (fichier modifié à la main, ancienne version).
    raw = store.read();
    const bad = validateValues(raw);
    const skipped = Object.keys(bad);
    if (skipped.length) console.error(`Réglages ignorés dans config.json : ${skipped.join(', ')}.`);
    overrides = Object.fromEntries(Object.entries(raw).filter(([k, v]) => !bad[k] && v !== ''));
    replaceInPlace(config, build(Object.assign({}, env, overrides)));
  }
  reload();

  const settings = {
    writable: store.writable,
    onChange(fn) { listeners.push(fn); },
    describe() {
      return FIELDS.map((f) => {
        const inEnv = env[f.key] !== undefined && env[f.key] !== '';
        const source = f.key in overrides ? 'admin' : inEnv ? 'env' : 'default';
        return Object.assign({}, f, {
          value: source === 'admin' ? overrides[f.key] : source === 'env' ? env[f.key] : '',
          source,
          envValue: inEnv ? env[f.key] : '',
          effective: EFFECTIVE[f.key] ? EFFECTIVE[f.key](config) : '',
        });
      });
    },
    // Valide puis enregistre un lot de modifications ; "" supprime la surcharge.
    save(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.getPrototypeOf(patch) !== Object.prototype) {
        return { ok: false, errors: { _: 'Requête invalide.' } };
      }
      const errors = validateValues(patch);
      if (Object.keys(errors).length) return { ok: false, errors };
      if (!store.writable) return { ok: false, errors: { _: 'Les réglages ne peuvent pas être enregistrés : dossier de données en lecture seule.' } };
      // Fusion sur le contenu brut du fichier : les clés d'une version plus récente sont conservées.
      const next = Object.fromEntries(Object.entries(raw));
      for (const [k, v] of Object.entries(patch)) {
        if (v.trim() === '') delete next[k]; else next[k] = v.trim();
      }
      try {
        store.write(next);
      } catch (err) {
        console.error('Enregistrement des réglages impossible :', err.message);
        return { ok: false, errors: { _: 'Les réglages n’ont pas pu être enregistrés (' + (err.code || 'erreur d’écriture') + ').' } };
      }
      reload();
      listeners.forEach((fn) => fn(config));
      return { ok: true };
    },
    restorePrevious() {
      try {
        if (!store.restorePrevious()) return false;
      } catch (err) {
        console.error('Restauration des réglages impossible :', err.message);
        return false;
      }
      reload();
      listeners.forEach((fn) => fn(config));
      return true;
    },
  };
  return { config, settings };
}

const DATA_DIR = process.env.DATA_DIR || '/data';
const { config, settings } = createSettings({ env: process.env, dir: DATA_DIR });

// Vue publique transmise au navigateur (aucune donnée sensible).
function publicConfigOf(config) {
  return {
    brand: config.brand,
    brandLogoUrl: config.brandLogoUrl,
    davPreset: config.davPreset,
    organization: config.profile.org,
    imap: config.imap,
    smtp: config.smtp,
    caldavUrl: config.caldavUrl,
    carddavUrl: config.carddavUrl,
    tasksUrl: config.tasksUrl,
    davDiscoveryUrl: config.davDiscoveryUrl,
    davCardDiscoveryUrl: config.davCardDiscoveryUrl,
    davTemplates: config.davTemplates,
    webmailUrl: config.webmailUrl,
    publicUrl: config.publicUrl,
    support: Object.assign({}, config.support, { phoneUri: telUri(config.support.phone) }),
    links: config.links,
    connectionTest: config.connectionTest,
    testMessages: config.testMessages,
  };
}
const publicConfig = () => publicConfigOf(config);



module.exports = { config, settings, publicConfig, publicConfigOf, telUri, davUrl, createSettings, DATA_DIR };
