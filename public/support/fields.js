// Espace d'administration : rendu d'un réglage selon son type (format de settings.describe() :
// { key, group, label, type, options, value, source, effective }) et valeurs déduites des autres réglages.
// Aucun style inline : les aperçus de couleur passent par des propriétés CSS (CSSOM), autorisées par la CSP.

// Valeurs intégrées (server/config.js) des réglages indépendants.
export const DEFAULTS = {
  BRAND_NAME: 'mccs', MAIL_HOST: 'mail.example.com', IMAP_PORT: '993', SMTP_PORT: '465',
  IMAP_SECURITY: 'SSL/TLS', SMTP_SECURITY: 'SSL/TLS', DAV_PRESET: 'mdaemon',
  PUBLIC_URL: 'https://config.example.com', PROFILE_ID_PREFIX: 'com.example.mailsetup',
};
export const DEFAULT_ACCENT = '#1f5f8b';

// Explications affichées sous chaque champ (le jargon est expliqué une fois, là où il apparaît).
export const HELP = {
  BRAND_NAME: 'Le nom de votre service, affiché en haut de chaque page et dans les messages envoyés aux clients.',
  BRAND_LOGO_URL: 'PNG, JPEG ou WebP, 2 Mo au maximum. Un logo horizontal, sur fond transparent, rend le mieux.',
  BRAND_ACCENT: 'La couleur des boutons et des repères. Choisissez une couleur assez foncée pour que le texte blanc reste lisible dessus.',
  BRAND_BACKGROUND: 'Le fond derrière les pages du configurateur.',
  MAIL_HOST: 'Le nom de votre serveur de messagerie. Les serveurs de réception et d’envoi reprennent ce nom, sauf si vous en indiquez d’autres.',
  IMAP_HOST: 'IMAP est le protocole de réception : les applications l’utilisent pour télécharger les e-mails.',
  IMAP_PORT: 'Habituellement 993 avec SSL/TLS, ou 143 avec STARTTLS.',
  IMAP_SECURITY: 'La façon dont la connexion est chiffrée. Prenez la même que dans votre serveur mail.',
  SMTP_HOST: 'SMTP est le protocole d’envoi : les applications l’utilisent pour expédier les e-mails.',
  SMTP_PORT: 'Habituellement 465 avec SSL/TLS, ou 587 avec STARTTLS.',
  SMTP_SECURITY: 'La façon dont la connexion est chiffrée. Prenez la même que dans votre serveur mail.',
  WEBMAIL_URL: 'La page où vos clients lisent leurs e-mails dans un navigateur.',
  ALLOWED_DOMAINS: 'Seules les adresses de ces domaines pourront vérifier leur mot de passe sur le configurateur. Sans domaine, toutes les adresses sont acceptées.',
  DAV_BASE_URL: 'À remplir seulement si l’agenda et les contacts sont sur un autre serveur que la messagerie. La détection automatique part de cette adresse.',
  CALDAV_URL: 'Adresse générale de l’agenda, montrée tant que le client n’a pas saisi son adresse.',
  CARDDAV_URL: 'Adresse générale des contacts, montrée tant que le client n’a pas saisi son adresse.',
  TASKS_URL: 'Adresse générale des tâches.',
  DAV_DISCOVERY_URL: 'L’adresse de l’agenda (CalDAV) donnée aux applications, qui y trouvent seules les agendas du client. Remplie par la détection automatique.',
  DAV_CARD_DISCOVERY_URL: 'L’adresse des contacts (CardDAV) donnée aux applications. Remplie par la détection automatique.',
  DAV_PRINCIPAL_URL_TEMPLATE: 'Variables possibles : {email} (adresse complète), {local} (avant le @) et {domain} (après le @).',
  DAV_CALENDAR_URL_TEMPLATE: 'Variables possibles : {email}, {local} et {domain}.',
  DAV_TASKS_URL_TEMPLATE: 'Variables possibles : {email}, {local} et {domain}.',
  DAV_CONTACTS_URL_TEMPLATE: 'Variables possibles : {email}, {local} et {domain}.',
  PUBLIC_URL: 'L’adresse de ce configurateur, telle que vos clients la voient. Elle sert aux liens et QR codes que vous leur envoyez.',
  SUPPORT_PHONE: 'Tel que vos clients doivent le composer. Ajoutez l’indicatif du pays (+…) si certains appellent de l’étranger, et le poste éventuel, par exemple +1 555 010 0100 ext. 12.',
  SUPPORT_HOURS: 'Par exemple : du lundi au vendredi, de 8 h à 17 h.',
  PROFILE_ORGANIZATION: 'Le nom affiché sur l’iPhone, l’iPad ou le Mac quand le client installe le profil.',
  CONNECTION_TEST: 'Sur la page d’accueil, le client saisit aussi son mot de passe : mccs se connecte à vos serveurs de réception puis d’envoi pour vérifier qu’il fonctionne, avant de le guider. Le mot de passe n’est ni enregistré ni journalisé.',
  CONNECTION_TEST_MAX_PER_EMAIL: 'Au-delà, la vérification est refusée pour cette adresse pendant 15 minutes. Gardez ce nombre plus bas que le seuil de blocage de votre serveur mail.',
  CONNECTION_TEST_MAX_PER_IP: 'Toutes adresses confondues, depuis un même appareil ou réseau. Derrière un proxy, l’adresse IP réelle n’est connue que si TRUSTED_PROXY_HEADER est réglé.',
  PROFILE_ID_PREFIX: 'Un identifiant technique, écrit comme un nom de domaine à l’envers (par exemple com.example.mail). Évitez de le changer : les appareils s’en servent pour reconnaître le profil.',
};

const OPTION_LABELS = {
  'SSL/TLS': 'SSL/TLS (chiffrée dès la connexion)',
  STARTTLS: 'STARTTLS (chiffrée juste après la connexion)',
  mdaemon: 'MDaemon',
  generic: 'Serveur CalDAV/CardDAV standard',
};
export const optionLabel = (v) => OPTION_LABELS[v] || v;
// Interrupteur : valeur « vraie » (le .env accepte aussi 1, on, yes, oui).
export const isOn = (v) => /^(1|true|on|yes|oui)$/i.test(String(v || '').trim());

const SOURCE_LABELS = { default: 'par défaut', env: '.env', admin: 'modifié ici' };
const SOURCE_TITLES = {
  default: 'Valeur intégrée à mccs ou déduite des autres réglages.',
  env: 'Valeur lue dans le fichier .env du serveur.',
  admin: 'Valeur enregistrée depuis cet espace d’administration.',
};

/* ---------- Validation (mêmes règles que server/settings.js, pour un retour immédiat) ---------- */
const LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const HEX = '#(?:[0-9a-f]{3}|[0-9a-f]{6})';
const COLOR_RE = new RegExp('^' + HEX + '$', 'i');
const BACKGROUND_RE = new RegExp('^(?:' + HEX + '(?:,' + HEX + ')?|/uploads/[a-z0-9-]+\\.(?:png|jpe?g|webp))$', 'i');
const LOGO_PATH_RE = /^\/(?:img|uploads)\/[A-Za-z0-9._/-]+\.(?:svg|png|jpe?g|webp)$/;
const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/;
// Téléphone, tous pays : + en tête facultatif, chiffres, espaces (y compris insécables), ( ) . / -,
// puis un poste facultatif (« ext. 12 », « x 12 », « poste 12 », « #12 »). De 3 à 17 chiffres hors poste ;
// lettres et caractères de contrôle refusés.
const PHONE_RE = /^\+?[0-9(][0-9   ().\/-]*?(?:[   ]*(?:ext\.?|x|poste|#)[   ]*[0-9]{1,6})?$/i;
const PHONE_EXT_RE = /[   ]*(?:ext\.?|x|poste|#)[   ]*[0-9]{1,6}$/i;
function isPhone(raw) {
  const v = String(raw).trim();
  if (/[\u0000-\u001f\u007f-\u009f]/.test(raw) || v.length > 40 || !PHONE_RE.test(v)) return false;
  const main = v.replace(PHONE_EXT_RE, '');
  const digits = main.replace(/\D/g, '').length;
  let depth = 0;
  for (const ch of main) {
    if (ch === '(') depth++;
    if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0 && digits >= 3 && digits <= 17;
}
export const isHost = (v) => v.length <= 253 && v.split('.').length >= 2 && v.split('.').every((l) => LABEL_RE.test(l));
const isHttpUrl = (v) => {
  try { const u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname); } catch { return false; }
};
const CHECKS = {
  host: (v) => (isHost(v) ? '' : 'Nom de serveur invalide (ex. mail.example.com).'),
  port: (v) => (/^\d{1,5}$/.test(v) && +v > 0 && +v < 65536 ? '' : 'Port invalide (nombre entre 1 et 65535).'),
  url: (v) => (isHttpUrl(v) ? '' : 'Adresse invalide : elle doit commencer par https:// ou http://.'),
  template: (v) => (isHttpUrl(v.replace(/\{(email|local|domain)\}/g, 'x')) ? '' : 'Gabarit invalide : une adresse https://, avec {email}, {local} ou {domain}.'),
  color: (v) => (COLOR_RE.test(v) ? '' : 'Couleur invalide (format #rrggbb).'),
  background: (v) => (BACKGROUND_RE.test(v) ? '' : 'Fond invalide : une couleur #rrggbb, deux couleurs ou une image envoyée.'),
  logo: (v) => (LOGO_PATH_RE.test(v) || isHttpUrl(v) ? '' : 'Logo invalide : une image envoyée ou une adresse https://.'),
  email: (v) => (EMAIL_RE.test(v) ? '' : 'Adresse e-mail invalide.'),
  phone: (v, raw) => (isPhone(raw) ? '' : 'Numéro de téléphone invalide : des chiffres, avec + et l’indicatif du pays si besoin (ex. +1 555 010 0100, poste « ext. 12 »).'),
  'reverse-dns': (v) => (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v) ? '' : 'Format attendu : com.example.mailsetup.'),
  toggle: (v, raw) => (raw === 'true' || raw === 'false' ? '' : 'Valeur attendue : true ou false.'),
  count: (v) => (/^\d{1,5}$/.test(v) && +v >= 1 && +v <= 10000 ? '' : 'Nombre entier entre 1 et 10000.'),
  message: (v, raw) => (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(raw) ? 'Caractère de contrôle refusé.' : ''),
  domains: (v) => {
    const bad = v.split(',').map((s) => s.trim()).filter((d) => d && !isHost(d));
    return bad.length ? `Domaine invalide : ${bad.join(', ')} (ex. example.com).` : '';
  },
};
export function check(type, value) {
  const raw = String(value || '');
  const v = raw.trim();
  if (!v || v.length > 500) return v.length > 500 ? 'Valeur trop longue (500 caractères au maximum).' : '';
  return CHECKS[type] ? CHECKS[type](v, raw) : '';
}

/* ---------- Valeurs déduites (même logique que server/config.js) ---------- */
// Remplace {email}, {local} et {domain} dans un gabarit d'URL DAV.
export function davUrl(template, email) {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  const enc = (s) => encodeURIComponent(s).replace(/%40/g, '@');
  return template.replace(/\{email\}/g, enc(local + '@' + domain)).replace(/\{local\}/g, enc(local)).replace(/\{domain\}/g, enc(domain));
}
// Type de serveur déduit d'une adresse saisie à la main : les chemins /webdav/ sont ceux de MDaemon.
export const presetFor = (url) => (/^https?:\/\/[^/]+\/webdav(?:\/|$)/i.test(String(url || '').trim()) ? 'mdaemon' : 'generic');

function presetUrls(preset, base, cal, card) {
  if (preset === 'generic') {
    return { CALDAV_URL: cal, CARDDAV_URL: card, TASKS_URL: cal, DAV_PRINCIPAL_URL_TEMPLATE: cal, DAV_CALENDAR_URL_TEMPLATE: cal, DAV_TASKS_URL_TEMPLATE: cal, DAV_CONTACTS_URL_TEMPLATE: card };
  }
  return {
    CALDAV_URL: base + '/webdav/calendar',
    CARDDAV_URL: base + '/webdav/addressbook',
    TASKS_URL: base + '/webdav/tasklist',
    DAV_PRINCIPAL_URL_TEMPLATE: base + '/webdav/principals/{email}/',
    DAV_CALENDAR_URL_TEMPLATE: base + '/webdav/caldav/{domain}/{local}/b64=Q2FsZW5kYXI/',
    DAV_TASKS_URL_TEMPLATE: base + '/webdav/caldav/{domain}/{local}/b64=VGFza3M/',
    DAV_CONTACTS_URL_TEMPLATE: base + '/webdav/carddav/{domain}/{local}/b64=Q29udGFjdHM/',
  };
}

const PRESET_KEYS = ['CALDAV_URL', 'CARDDAV_URL', 'TASKS_URL', 'DAV_PRINCIPAL_URL_TEMPLATE', 'DAV_CALENDAR_URL_TEMPLATE', 'DAV_TASKS_URL_TEMPLATE', 'DAV_CONTACTS_URL_TEMPLATE'];

// entries : Map clé → { field, value } (contrôles affichés ou valeurs enregistrées).
// resolve(k) : la valeur qui s'appliquera si l'on enregistre maintenant ; fallback(k) : celle d'un champ laissé vide.
export function resolver(entries) {
  const fallback = (k) => {
    const e = entries.get(k);
    const f = e && e.field;
    // Valeur du .env (même quand un réglage « modifié ici » la masque) : c'est elle qui s'applique si l'on vide le champ.
    if (f && f.envValue) return f.envValue;
    // Valeur intégrée donnée par le serveur (interrupteur, limites, messages d'aide).
    if (f && f.default !== undefined) return f.default;
    const mail = () => resolve('MAIL_HOST');
    const base = () => resolve('DAV_BASE_URL').replace(/\/+$/, '');
    switch (k) {
      case 'IMAP_HOST': case 'SMTP_HOST': return mail();
      case 'WEBMAIL_URL': return 'https://' + mail() + '/';
      case 'DAV_BASE_URL': return 'https://' + mail();
      case 'DAV_DISCOVERY_URL': return base() + '/.well-known/caldav';
      case 'DAV_CARD_DISCOVERY_URL': return base() + '/.well-known/carddav';
      case 'PROFILE_ORGANIZATION': return resolve('BRAND_NAME');
      default: {
        if (k in DEFAULTS) return DEFAULTS[k];
        if (PRESET_KEYS.includes(k)) return presetUrls(resolve('DAV_PRESET'), base(), resolve('DAV_DISCOVERY_URL'), resolve('DAV_CARD_DISCOVERY_URL'))[k];
        return f && f.source === 'default' ? f.effective || '' : '';
      }
    }
  };
  const resolve = (k) => {
    const e = entries.get(k);
    const v = e ? String(e.value || '').trim() : '';
    return v || fallback(k);
  };
  return { resolve, fallback };
}

// Adresse d'exemple : prenom.nom@<domaine de MAIL_HOST> (mail.example.com -> example.com).
export function exampleEmail(mailHost) {
  const labels = String(mailHost || 'example.com').split('.');
  return 'prenom.nom@' + (labels.length > 2 ? labels.slice(1) : labels).join('.');
}

// Valeur de BRAND_BACKGROUND -> valeur CSS (même rendu que /brand.css).
export function backgroundCss(v) {
  if (/^#[0-9a-f]+,#[0-9a-f]+$/i.test(v)) { const [a, b] = v.split(','); return `linear-gradient(160deg, ${a}, ${b})`; }
  if (/^#[0-9a-f]+$/i.test(v)) return v;
  if (/^\/uploads\/[a-z0-9-]+\.(?:png|jpe?g|webp)$/i.test(v)) return `center / cover no-repeat url("${v}"), var(--bg)`;
  return '';
}

/* ---------- Petits utilitaires DOM ---------- */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v; // uniquement pour les icônes SVG statiques de ce fichier
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
export const ICONS = {
  upload: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  x: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  undo: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
};

let uid = 0;
const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const UPLOAD_MAX = 2 * 1024 * 1024;

/* ---------- Éditeurs par type ---------- */
function textEditor(field, id, emit) {
  const t = field.type;
  const mono = ['host', 'port', 'count', 'url', 'template', 'reverse-dns'].includes(t);
  const input = h('input', {
    id,
    type: t === 'email' ? 'email' : t === 'phone' ? 'tel' : 'text',
    inputmode: t === 'port' || t === 'count' ? 'numeric' : t === 'host' || t === 'url' || t === 'template' ? 'url' : t === 'email' ? 'email' : t === 'phone' ? 'tel' : undefined,
    maxlength: t === 'port' || t === 'count' ? '5' : '500',
    class: mono ? 'is-mono' : undefined,
    autocomplete: 'off',
    autocapitalize: t === 'text' ? undefined : 'off',
    spellcheck: t === 'text' ? undefined : 'false',
    oninput: emit,
  });
  return {
    node: input, input,
    get: () => input.value,
    set: (v) => { input.value = v; },
    hint: (t2) => { input.placeholder = t2; },
    disable: (b) => { input.readOnly = b; },
  };
}

function selectEditor(field, id, emit) {
  const empty = h('option', { value: '' });
  const sel = h('select', { id, onchange: emit }, empty, (field.options || []).map((o) => h('option', { value: o, text: optionLabel(o) })));
  return {
    node: sel, input: sel,
    get: () => sel.value,
    set: (v) => { sel.value = (field.options || []).includes(v) ? v : ''; },
    hint: (t) => { empty.textContent = t ? 'Par défaut : ' + (field.type === 'preset' ? optionLabel(t) : t) : 'Par défaut'; },
    disable: (b) => { sel.disabled = b; },
  };
}

const expandHex = (v) => (/^#[0-9a-f]{3}$/i.test(v) ? '#' + v.slice(1).split('').map((c) => c + c).join('') : v);

// Couleur : pastille (sélecteur natif) + saisie #rrggbb.
function colorEditor(field, id, emit, { label = 'Choisir la couleur', fallbackColor = DEFAULT_ACCENT } = {}) {
  const picker = h('input', { type: 'color', class: 'swatch-input', 'aria-label': label });
  const swatch = h('label', { class: 'swatch', title: label }, picker);
  const text = h('input', { id, type: 'text', class: 'is-mono', maxlength: '7', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  let ph = '';
  const paint = () => {
    const v = text.value.trim();
    const c = COLOR_RE.test(v) ? expandHex(v) : COLOR_RE.test(ph) ? expandHex(ph) : '';
    // Sans couleur : la pastille montre l'accent intégré du thème (var(--ink-default) dans support.css).
    if (c) swatch.style.setProperty('--sw', c); else swatch.style.removeProperty('--sw');
    swatch.classList.toggle('is-default', !COLOR_RE.test(v));
    picker.value = (c || (matchMedia('(prefers-color-scheme: dark)').matches ? '#8cbfe6' : fallbackColor)).toLowerCase();
  };
  picker.addEventListener('input', () => { text.value = picker.value; paint(); emit(); });
  text.addEventListener('input', () => { paint(); emit(); });
  const node = h('div', { class: 'color-ed' }, swatch, text);
  return {
    node, input: text,
    get: () => text.value,
    set: (v) => { text.value = v; paint(); },
    hint: (t) => { ph = t; text.placeholder = COLOR_RE.test(t) ? t : 'Bleu encre (par défaut)'; paint(); },
    disable: (b) => { text.readOnly = b; picker.disabled = b; },
  };
}

// Envoi d'image (logo ou fond) : bouton + champ fichier caché. upload(kind, file) -> Promise<chemin>.
function uploadButton(kind, ctx, onDone) {
  const file = h('input', { type: 'file', accept: UPLOAD_TYPES.join(','), class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  const btn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', html: ICONS.upload + '<span>Envoyer une image</span>' });
  btn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    if (!UPLOAD_TYPES.includes(f.type)) { ctx.setError('Format refusé : choisissez une image PNG, JPEG ou WebP.'); return; }
    if (f.size > UPLOAD_MAX) { ctx.setError('Image trop lourde : 2 Mo au maximum.'); return; }
    ctx.setError('');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const p = await ctx.upload(kind, f);
      if (p) onDone(p);
    } catch (err) {
      ctx.setError(err.message || 'L’envoi a échoué.');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  });
  return { node: h('span', { class: 'upload' }, btn, file), btn };
}

function logoEditor(field, id, emit, ctx) {
  const img = h('img', { alt: '', hidden: true });
  const empty = h('span', { class: 'logo-empty', text: 'Aucun logo' });
  const box = h('div', { class: 'logo-box' }, img, empty);
  const input = h('input', { id, type: 'text', inputmode: 'url', class: 'is-mono', maxlength: '500', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'https://… ou image envoyée' });
  let ph = '';
  const paint = () => {
    const v = input.value.trim() || ph;
    // Une image externe pas encore enregistrée serait bloquée par la CSP : pas d'aperçu dans ce cas.
    const local = /^\/(?:img|uploads)\//.test(v);
    const showable = v && (local || v === field.effective);
    img.hidden = !showable;
    if (showable) img.src = v; else img.removeAttribute('src');
    empty.hidden = Boolean(showable);
    empty.textContent = v ? 'Aperçu après l’enregistrement' : 'Aucun logo';
  };
  img.addEventListener('error', () => { img.hidden = true; empty.hidden = false; empty.textContent = 'Image introuvable'; });
  input.addEventListener('input', () => { paint(); emit(); });
  const up = uploadButton('logo', ctx, (p) => { input.value = p; paint(); emit(); });
  const node = h('div', { class: 'logo-ed' }, box, h('div', { class: 'logo-side' }, up.node, h('span', { class: 'logo-or', text: 'ou indiquez l’adresse d’une image :' }), input));
  return {
    node, input,
    get: () => input.value,
    set: (v) => { input.value = v; paint(); },
    hint: (t) => { ph = t; paint(); },
    disable: (b) => { input.readOnly = b; up.btn.disabled = b; },
  };
}

// Fond : par défaut, couleur unie, dégradé de deux couleurs ou image envoyée.
function backgroundEditor(field, id, emit, ctx) {
  const name = 'bg-' + (++uid);
  const MODES = [['default', 'Par défaut'], ['color', 'Couleur unie'], ['gradient', 'Dégradé'], ['image', 'Image']];
  let mode = 'default';
  let image = '';
  const radios = {};
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': id + '-label' }, MODES.map(([m, label]) => {
    const r = h('input', { type: 'radio', name, value: m, id: id + '-' + m });
    radios[m] = r;
    r.addEventListener('change', () => { if (r.checked) { setMode(m); emit(); } });
    return h('label', { class: 'seg-opt', for: id + '-' + m }, r, h('span', { text: label }));
  }));
  const a = colorEditor(field, id + '-a', () => { paint(); emit(); }, { label: 'Première couleur', fallbackColor: '#e8eef5' });
  const b = colorEditor(field, id + '-b', () => { paint(); emit(); }, { label: 'Deuxième couleur', fallbackColor: '#c9d8e8' });
  const thumb = h('div', { class: 'bg-thumb', 'aria-hidden': 'true' });
  const imgName = h('span', { class: 'bg-file', text: 'Aucune image' });
  const up = uploadButton('background', ctx, (p) => { image = p; paint(); emit(); });
  const labelA = h('span', { class: 'bg-color-label', text: 'Couleur' });
  const colors = h('div', { class: 'bg-colors' }, h('div', { class: 'bg-color' }, labelA, a.node), h('div', { class: 'bg-color bg-color-b' }, h('span', { class: 'bg-color-label', text: 'Vers' }), b.node));
  const imgRow = h('div', { class: 'bg-image' }, up.node, imgName);
  const detail = h('div', { class: 'bg-detail' }, thumb, h('div', { class: 'bg-controls' }, colors, imgRow));
  let ph = '';
  function value() {
    if (mode === 'color') return a.get().trim();
    if (mode === 'gradient') return a.get().trim() + ',' + b.get().trim();
    if (mode === 'image') return image;
    return '';
  }
  function paint() {
    const css = backgroundCss(value() || (mode === 'default' ? ph : ''));
    if (css) thumb.style.setProperty('--thumb', css); else thumb.style.removeProperty('--thumb');
    imgName.textContent = image ? image.split('/').pop() : 'Aucune image envoyée';
  }
  function setMode(m) {
    mode = m;
    radios[m].checked = true;
    detail.hidden = m === 'default';
    colors.hidden = m !== 'color' && m !== 'gradient';
    colors.classList.toggle('is-gradient', m === 'gradient');
    labelA.textContent = m === 'gradient' ? 'De' : 'Couleur';
    imgRow.hidden = m !== 'image';
    if ((m === 'color' || m === 'gradient') && !COLOR_RE.test(a.get().trim())) a.set('#e8eef5');
    if (m === 'gradient' && !COLOR_RE.test(b.get().trim())) b.set('#c9d8e8');
    paint();
  }
  function set(v) {
    v = String(v || '').trim();
    if (/^#[0-9a-f]+,#[0-9a-f]+$/i.test(v)) { const [x, y] = v.split(','); a.set(x); b.set(y); setMode('gradient'); }
    else if (/^#/.test(v)) { a.set(v); setMode('color'); }
    else if (/^\/uploads\//.test(v)) { image = v; setMode('image'); }
    else setMode('default');
  }
  a.hint('#e8eef5');
  b.hint('#c9d8e8');
  const node = h('div', { class: 'bg-ed' }, seg, detail);
  return {
    node, input: radios.default,
    get: value,
    set,
    hint: (t) => {
      ph = t;
      const what = !t ? 'le fond neutre du thème clair ou sombre' : t.includes(',') ? 'un dégradé (' + t.replace(',', ' vers ') + ')' : t.startsWith('#') ? 'la couleur ' + t : 'une image';
      radios.default.parentElement.title = 'Fond actuel : ' + what;
      paint();
    },
    disable: (d) => { Object.values(radios).forEach((r) => { r.disabled = d; }); a.disable(d); b.disable(d); up.btn.disabled = d; },
  };
}

// Domaines : liste d'étiquettes, sérialisée « a.com,b.com ».
function domainsEditor(field, id, emit, ctx) {
  let list = [];
  const ul = h('ul', { class: 'chips-list', 'aria-label': 'Domaines acceptés' });
  const none = h('p', { class: 'chips-none', text: 'Toutes les adresses sont acceptées.' });
  const input = h('input', { id, type: 'text', inputmode: 'url', class: 'is-mono', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'example.com' });
  const add = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Ajouter' });
  const norm = (s) => s.trim().toLowerCase().replace(/^@/, '').replace(/\.$/, '');
  function paint() {
    ul.replaceChildren(...list.map((d) => h('li', { class: 'chip-item' },
      h('span', { class: 'is-mono', text: d }),
      h('button', { type: 'button', class: 'chip-x', 'aria-label': 'Retirer ' + d, html: ICONS.x, onclick: () => { list = list.filter((x) => x !== d); paint(); emit(); input.focus(); } }),
    )));
    ul.hidden = !list.length;
    none.hidden = Boolean(list.length);
  }
  function commit() {
    const parts = input.value.split(/[\s,;]+/).map(norm).filter(Boolean);
    if (!parts.length) return true;
    const bad = parts.filter((d) => !isHost(d));
    if (bad.length) { ctx.setError(`« ${bad[0]} » n’est pas un nom de domaine valide (ex. example.com).`); return false; }
    ctx.setError('');
    for (const d of parts) if (!list.includes(d)) list.push(d);
    input.value = '';
    paint();
    emit();
    return true;
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } });
  input.addEventListener('blur', () => { if (input.value.trim()) commit(); });
  add.addEventListener('click', () => { commit(); input.focus(); });
  const node = h('div', { class: 'chips-ed' }, ul, none, h('div', { class: 'chips-add' }, input, add));
  return {
    node, input,
    // Un domaine tapé sans « Ajouter » compte quand même.
    get: () => {
      const extra = input.value.split(/[\s,;]+/).map(norm).filter(Boolean);
      return [...list, ...extra.filter((d) => !list.includes(d))].join(',');
    },
    set: (v) => { list = String(v || '').split(',').map(norm).filter(Boolean); input.value = ''; paint(); },
    hint: (t) => { none.textContent = t ? 'Domaines actuels (fichier .env) : ' + t.split(/\s*,\s*/).join(', ') + '.' : 'Toutes les adresses sont acceptées.'; },
    disable: (b) => { input.readOnly = b; add.disabled = b; ul.querySelectorAll('button').forEach((x) => { x.disabled = b; }); },
    flush: commit,
  };
}

// Interrupteur : '' suit la valeur par défaut (ou du .env) ; sinon « true » ou « false ».
// Remettre l'interrupteur dans l'état par défaut retire la valeur saisie ici.
function toggleEditor(field, id, emit) {
  const box = h('input', { id, type: 'checkbox', role: 'switch', class: 'switch-input' });
  const text = h('span', { class: 'switch-text' });
  let val = '';
  let ph = 'false';
  const paint = () => {
    box.checked = isOn(val || ph);
    text.textContent = box.checked ? 'Activée' : 'Désactivée';
  };
  box.addEventListener('change', () => {
    const want = box.checked ? 'true' : 'false';
    val = want === (isOn(ph) ? 'true' : 'false') ? '' : want;
    paint();
    emit();
  });
  const node = h('label', { class: 'switch', for: id }, box, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), text);
  return {
    node, input: box,
    get: () => val,
    set: (v) => { val = v === 'true' || v === 'false' ? v : ''; paint(); },
    hint: (t) => { ph = t || 'false'; paint(); },
    disable: (b) => { box.disabled = b; },
    // Valeur effective affichée par l'interrupteur (utile aux encadrés qui en dépendent).
    on: () => box.checked,
  };
}

// Message montré au client : zone de texte ; vide = texte par défaut (en gris). Au premier clic dans une
// zone vide, le texte par défaut est recopié pour être retouché ; inchangé, il compte toujours comme vide.
function messageEditor(field, id, emit) {
  const ta = h('textarea', { id, rows: '4', maxlength: '500', class: 'msg-input', oninput: emit });
  let ph = '';
  ta.addEventListener('focus', () => {
    if (!ta.value && ph && !ta.readOnly) { ta.value = ph; ta.setSelectionRange(ph.length, ph.length); }
  });
  ta.addEventListener('blur', () => { if (ta.value.trim() === ph.trim()) { ta.value = ''; emit(); } });
  return {
    node: ta, input: ta,
    get: () => (ta.value.trim() === ph.trim() ? '' : ta.value),
    set: (v) => { ta.value = v; },
    hint: (t) => { ph = t || ''; ta.placeholder = ph; },
    disable: (b) => { ta.readOnly = b; },
  };
}

const EDITORS = { toggle: toggleEditor, message: messageEditor, security: selectEditor, preset: selectEditor, color: colorEditor, logo: logoEditor, background: backgroundEditor, domains: domainsEditor };

/* ---------- Contrôle complet : libellé, provenance, éditeur, aide, erreur ---------- */
// opts : { meta: bool (provenance et « Revenir au défaut »), onChange(ctrl), onReset(ctrl), upload(kind, file) }
export function createControl(field, opts = {}) {
  const id = 'f-' + field.key.toLowerCase().replace(/_/g, '-') + '-' + (++uid);
  const initial = (f) => (f.source === 'admin' ? String(f.value || '') : '');
  // Les domaines sont comparés une fois normalisés (« a.com, b.com » = « a.com,b.com »).
  const canon = (v) => (field.type === 'domains' ? String(v || '').split(/[\s,;]+/).map((d) => d.trim().toLowerCase()).filter(Boolean).join(',') : String(v || '').trim());
  const errEl = h('p', { class: 'field-error', id: id + '-error', role: 'alert', hidden: true });
  const helpText = HELP[field.key] || '';
  const helpEl = helpText ? h('p', { class: 'field-help', id: id + '-help', text: helpText }) : null;
  const ctrl = {
    key: field.key,
    field,
    base: initial(field),
    get value() { return editor.get(); },
    isDirty() { return canon(editor.get()) !== canon(ctrl.base); },
    setError(msg) {
      errEl.textContent = msg || '';
      errEl.hidden = !msg;
      if (editor.input) editor.input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      wrap.classList.toggle('has-error', Boolean(msg));
    },
    upload: (kind, file) => opts.upload(kind, file),
  };
  const emit = () => { ctrl.setError(''); paintMeta(); if (opts.onChange) opts.onChange(ctrl); };
  const editor = (EDITORS[field.type] || textEditor)(field, id, emit, ctrl);
  if (editor.input) {
    editor.input.setAttribute('aria-describedby', [helpEl && helpEl.id, errEl.id].filter(Boolean).join(' '));
  }

  const labelEl = h(field.type === 'background' ? 'span' : 'label', { class: 'afield-label', id: id + '-label', for: field.type === 'background' ? undefined : id, text: field.label });
  const badge = h('span', { class: 'src' });
  const pending = h('span', { class: 'src src-pending', text: 'non enregistré', hidden: true });
  const reset = h('button', { type: 'button', class: 'link-btn afield-reset', html: ICONS.undo + '<span>Revenir au défaut</span>', title: 'Supprime la valeur saisie ici : la valeur du fichier .env ou la valeur intégrée s’applique de nouveau.', hidden: true });
  reset.addEventListener('click', () => opts.onReset && opts.onReset(ctrl));
  let readOnly = false;

  function paintMeta() {
    if (!opts.meta) return;
    const s = ctrl.field.source;
    badge.textContent = SOURCE_LABELS[s] || s;
    badge.className = 'src src-' + s;
    badge.title = SOURCE_TITLES[s] || '';
    pending.hidden = !ctrl.isDirty();
    reset.hidden = readOnly || s !== 'admin';
  }

  const head = h('div', { class: 'afield-head' }, labelEl, opts.meta ? h('span', { class: 'afield-badges' }, badge, pending) : null, opts.meta ? reset : null);
  const wrap = h('div', { class: 'field afield afield-' + field.type, 'data-key': field.key }, head, editor.node, helpEl, errEl);
  ctrl.el = wrap;

  ctrl.setValue = (v) => { editor.set(v); paintMeta(); };
  ctrl.setHint = (t) => editor.hint(t || '');
  ctrl.setField = (f, { force = false } = {}) => {
    const keep = ctrl.isDirty() && !force;
    ctrl.field = f;
    ctrl.base = initial(f);
    if (!keep) editor.set(ctrl.base);
    paintMeta();
  };
  ctrl.setReadOnly = (b) => { readOnly = b; editor.disable(b); paintMeta(); };
  ctrl.focus = () => { if (editor.input) editor.input.focus(); };
  ctrl.isOn = () => (editor.on ? editor.on() : isOn(editor.get()));
  // Valide la valeur saisie ; un domaine en cours de saisie est d'abord ajouté.
  ctrl.validate = () => {
    if (editor.flush && !editor.flush()) return false;
    const msg = check(field.type, editor.get());
    ctrl.setError(msg);
    return !msg;
  };

  editor.set(ctrl.base);
  editor.hint(field.effective || '');
  paintMeta();
  return ctrl;
}
