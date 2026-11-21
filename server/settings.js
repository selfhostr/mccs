'use strict';

// Schéma des réglages modifiables (dans l'admin ou dans /data/config.json).
// Chaque clé porte le nom de la variable d'environnement correspondante.
const { normalizeEmail } = require('./validate');

const SECURITY = ['SSL/TLS', 'STARTTLS'];
const PRESETS = ['mdaemon', 'generic'];

const FIELDS = [
  // Marque
  { key: 'BRAND_NAME', group: 'brand', label: 'Nom affiché', type: 'text' },
  { key: 'BRAND_LOGO_URL', group: 'brand', label: 'Logo', type: 'logo' },
  { key: 'BRAND_ACCENT', group: 'brand', label: 'Couleur d’accent', type: 'color' },
  { key: 'BRAND_BACKGROUND', group: 'brand', label: 'Fond de page', type: 'background' },
  // Serveurs mail
  { key: 'MAIL_HOST', group: 'servers', label: 'Serveur mail principal', type: 'host' },
  { key: 'IMAP_HOST', group: 'servers', label: 'Serveur de réception (IMAP)', type: 'host' },
  { key: 'IMAP_PORT', group: 'servers', label: 'Port de réception', type: 'port' },
  { key: 'IMAP_SECURITY', group: 'servers', label: 'Sécurité de réception', type: 'security', options: SECURITY },
  { key: 'SMTP_HOST', group: 'servers', label: 'Serveur d’envoi (SMTP)', type: 'host' },
  { key: 'SMTP_PORT', group: 'servers', label: 'Port d’envoi', type: 'port' },
  { key: 'SMTP_SECURITY', group: 'servers', label: 'Sécurité d’envoi', type: 'security', options: SECURITY },
  { key: 'WEBMAIL_URL', group: 'servers', label: 'Adresse du webmail', type: 'url' },
  // Calendrier et contacts
  { key: 'DAV_PRESET', group: 'dav', label: 'Type de serveur', type: 'preset', options: PRESETS },
  { key: 'DAV_BASE_URL', group: 'dav', label: 'URL de base', type: 'url' },
  { key: 'CALDAV_URL', group: 'dav', label: 'URL de l’agenda', type: 'url' },
  { key: 'CARDDAV_URL', group: 'dav', label: 'URL des contacts', type: 'url' },
  { key: 'TASKS_URL', group: 'dav', label: 'URL des tâches', type: 'url' },
  { key: 'DAV_DISCOVERY_URL', group: 'dav', label: 'URL de découverte (agenda)', type: 'url' },
  { key: 'DAV_CARD_DISCOVERY_URL', group: 'dav', label: 'URL de découverte (contacts)', type: 'url' },
  { key: 'DAV_PRINCIPAL_URL_TEMPLATE', group: 'dav', label: 'Gabarit : compte', type: 'template' },
  { key: 'DAV_CALENDAR_URL_TEMPLATE', group: 'dav', label: 'Gabarit : agenda personnel', type: 'template' },
  { key: 'DAV_TASKS_URL_TEMPLATE', group: 'dav', label: 'Gabarit : tâches personnelles', type: 'template' },
  { key: 'DAV_CONTACTS_URL_TEMPLATE', group: 'dav', label: 'Gabarit : contacts personnels', type: 'template' },
  // Adresse publique de l'outil
  { key: 'PUBLIC_URL', group: 'public', label: 'Adresse publique de l’outil', type: 'url' },
  // Contact support
  { key: 'SUPPORT_PHONE', group: 'support', label: 'Téléphone', type: 'phone' },
  { key: 'SUPPORT_EMAIL', group: 'support', label: 'E-mail', type: 'email' },
  { key: 'SUPPORT_HOURS', group: 'support', label: 'Horaires', type: 'text' },
  { key: 'SUPPORT_ADDRESS', group: 'support', label: 'Adresse', type: 'text' },
  // Profil Apple
  { key: 'PROFILE_ORGANIZATION', group: 'profile', label: 'Organisation', type: 'text' },
  { key: 'PROFILE_ID_PREFIX', group: 'profile', label: 'Préfixe d’identifiant', type: 'reverse-dns' },
];

// Réglages qui ne se changent que dans l'environnement (jamais depuis l'admin).
const ENV_ONLY = ['PORT', 'SUPPORT_USER', 'SUPPORT_PASSWORD', 'DATA_DIR'];

const BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));
const MAX_LEN = 500;
const LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const HEX = '#(?:[0-9a-f]{3}|[0-9a-f]{6})';
const COLOR_RE = new RegExp('^' + HEX + '$', 'i');
const BACKGROUND_RE = new RegExp('^(?:' + HEX + '(?:,' + HEX + ')?|/uploads/[a-z0-9-]+\\.(?:png|jpe?g|webp))$', 'i');
const LOGO_PATH_RE = /^\/(?:img|uploads)\/[A-Za-z0-9._/-]+\.(?:svg|png|jpe?g|webp)$/;

function isHost(v) {
  const labels = v.split('.');
  return v.length <= 253 && labels.length >= 2 && labels.every((l) => LABEL_RE.test(l));
}
function isHttpUrl(v) {
  try {
    const u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname);
  } catch { return false; }
}

const CHECKS = {
  text: () => '',
  host: (v) => (isHost(v) ? '' : 'Nom de serveur invalide (ex. mail.example.com).'),
  port: (v) => (/^\d{1,5}$/.test(v) && +v > 0 && +v < 65536 ? '' : 'Port invalide (nombre entre 1 et 65535).'),
  security: (v) => (SECURITY.includes(v) ? '' : 'Choisissez SSL/TLS ou STARTTLS.'),
  preset: (v) => (PRESETS.includes(v) ? '' : 'Choisissez mdaemon ou generic.'),
  url: (v) => (isHttpUrl(v) ? '' : 'Adresse invalide : elle doit commencer par https:// ou http://.'),
  template: (v) => (isHttpUrl(v.replace(/\{(email|local|domain)\}/g, 'x')) ? '' : 'Gabarit invalide : une adresse https://, avec {email}, {local} ou {domain}.'),
  color: (v) => (COLOR_RE.test(v) ? '' : 'Couleur invalide (format #rrggbb).'),
  background: (v) => (BACKGROUND_RE.test(v) ? '' : 'Fond invalide : une couleur #rrggbb, deux couleurs « #a,#b » ou une image envoyée.'),
  logo: (v) => (LOGO_PATH_RE.test(v) || isHttpUrl(v) ? '' : 'Logo invalide : une image envoyée ou une adresse https://.'),
  email: (v) => (normalizeEmail(v) ? '' : 'Adresse e-mail invalide.'),
  phone: (v) => (/^[+\d][\d .()/-]{2,30}$/.test(v) ? '' : 'Numéro de téléphone invalide.'),
  'reverse-dns': (v) => (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v) ? '' : 'Format attendu : com.example.mailsetup.'),
};

// Renvoie { clé: message } pour chaque valeur refusée ; {} si tout est valide.
// Une chaîne vide est toujours acceptée : elle ramène le réglage à sa valeur par défaut.
function validateValues(values) {
  const errors = {};
  for (const [key, raw] of Object.entries(values || {})) {
    if (ENV_ONLY.includes(key)) { errors[key] = 'Ce réglage se change uniquement dans le fichier .env.'; continue; }
    const field = BY_KEY.get(key);
    if (!field) { errors[key] = 'Réglage inconnu.'; continue; }
    if (typeof raw !== 'string') { errors[key] = 'Valeur invalide.'; continue; }
    if (raw.length > MAX_LEN) { errors[key] = `Valeur trop longue (${MAX_LEN} caractères au maximum).`; continue; }
    const v = raw.trim();
    if (v === '') continue;
    const msg = CHECKS[field.type](v);
    if (msg) errors[key] = msg;
  }
  return errors;
}

module.exports = { FIELDS, ENV_ONLY, validateValues };
