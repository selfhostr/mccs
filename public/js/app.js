import { DEVICES, APPS, GUIDES } from './guides.js';
import { encode as qrEncode, toSvg as qrSvg } from './qr.js';

/* ---------- Icônes SVG (inline, sans dépendance) ---------- */
const S = (p, extra = '') => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const ICONS = {
  /* Logos de marque (Simple Icons, CC0 ; Windows et Outlook dessinés pour ce projet) : voir public/img/brands/README.md */
  windows: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-win" fill="currentColor"><path d="M2 3.8l8.6-1.2v8.2H2zM11.7 2.5L22 1v9.8H11.7zM2 12.1h8.6v8.2L2 19.1zM11.7 12.1H22V23l-10.3-1.4z"/></svg>`,
  macos: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-ink" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>`,
  apple: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-ink" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>`,
  ios: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-ink" fill="currentColor"><g transform="translate(-1.8 -1.8) scale(.9)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></g><rect x="14" y="10" width="9" height="13.5" rx="2.2" fill="#0A84FF"/><path d="M17.4 12.2h2.2" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/></svg>`,
  androidlogo: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-android" fill="currentColor"><path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z"/></svg>`,
  thunderbird: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-tb" fill="currentColor"><path d="M9.948 4.444h-.005c-1.92.788-2.126 2.55-1.817 3.499v.02C9.236 7.18 10.658 6.76 12 6.76c3.26 0 5.902 2.156 5.902 4.815 0 2.66-2.643 4.816-5.902 4.816l-.083-.002c-.155-.006-.354-.013-.435.118-.096.156.116.397.238.536 1.274 1.441 3.123 1.622 3.608 1.67l.076.008c-4.281.414-9.304-2.32-9.306-7.076 0-1.12.414-2.073 1.075-2.83l-.005-.002h-.003C7.31 6.38 6.376 3.47 4.629 2.898c-.124-.04-.246.054-.262.183-.23 1.924-.727 2.59-1.264 3.31-.805 1.08-1.39 2.328-1.365 3.698a10.99 10.99 0 0 1-.705-1.91c-.024-.09-.17-.365-.333-.272-.13.072-.227.274-.296.485A12.137 12.137 0 0 0 0 11.489c0 6.536 5.475 12 12 12 6.627 0 12-5.372 12-12 0-2.526-.781-4.87-2.115-6.805l.167-.002c.518 0 1.024.045 1.51.129-.734-.816-1.724-1.475-2.877-1.904a8.54 8.54 0 0 1 2.494-.495c-1.426-1.166-3.508-1.9-5.827-1.9-3.355 0-6.648 1.29-7.404 3.93zm.682 9.166c-.87-.905-3.473-3.91-3.473-3.91l.202.01 4.075 3.042c.305.223.74.22 1.043-.004l3.996-3.034.212-.018s-2.518 2.935-3.483 3.9c-.964.968-1.703.919-2.572.014zm2.774-10.083s.055.625-.576.824c-.722.227-1.042-.38-1.042-.38s.09-.417.676-.61c.626-.206.942.166.942.166z"/></svg>`,
  gmail: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-gmail" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>`,
  samsung: `<svg aria-hidden="true" viewBox="0 8.3 24 7.4" class="brand b-samsung b-wide" fill="currentColor"><path d="M19.8166 10.2808l.0459 2.6934h-.023l-.7793-2.6934h-1.2837v3.3925h.8481l-.0458-2.785h.023l.8366 2.785h1.2264v-3.3925zm-16.149 0l-.6418 3.427h.9284l.4699-3.1175h.0229l.4585 3.1174h.9169l-.6304-3.4269zm5.1805 0l-.424 2.6132h-.023l-.424-2.6132H6.5788l-.0688 3.427h.8596l.023-3.0832h.0114l.573 3.0831h.8711l.5731-3.083h.023l.0228 3.083h.8596l-.0802-3.4269zm-7.2664 2.4527c.0343.0802.0229.1949.0114.2522-.0229.1146-.1031.2292-.3324.2292-.2177 0-.3438-.126-.3438-.3095v-.3323H0v.2636c0 .7679.6074.9971 1.2493.9971.6189 0 1.1346-.2178 1.2149-.7794.0458-.298.0114-.4928 0-.5616-.1605-.722-1.467-.9283-1.5588-1.3295-.0114-.0688-.0114-.1375 0-.1834.023-.1146.1032-.2292.3095-.2292.2063 0 .321.126.321.3095v.2063h.8595v-.2407c0-.745-.6762-.8596-1.1576-.8596-.6074 0-1.1117.2063-1.2034.7564-.023.149-.0344.2866.0114.4585.1376.7106 1.364.9169 1.5358 1.3524m11.152 0c.0343.0803.0228.1834.0114.2522-.023.1146-.1032.2292-.3324.2292-.2178 0-.3438-.126-.3438-.3095v-.3323h-.917v.2636c0 .7564.596.9857 1.2379.9857.6189 0 1.1232-.2063 1.2034-.7794.0459-.298.0115-.4814 0-.5616-.1375-.7106-1.4327-.9284-1.5243-1.318-.0115-.0688-.0115-.1376 0-.1835.0229-.1146.1031-.2292.3094-.2292.1948 0 .321.126.321.3095v.2063h.848v-.2407c0-.745-.6647-.8596-1.146-.8596-.6075 0-1.1004.1948-1.192.7564-.023.149-.023.2866.0114.4585.1376.7106 1.341.9054 1.513 1.3524m2.8882.4585c.2407 0 .3094-.1605.3323-.2522.0115-.0343.0115-.0917.0115-.126v-2.533h.871v2.4642c0 .0688 0 .1948-.0114.2292-.0573.6419-.5616.8482-1.192.8482-.6303 0-1.1346-.2063-1.192-.8482 0-.0344-.0114-.1604-.0114-.2292v-2.4642h.871v2.533c0 .0458 0 .0916.0115.126 0 .0917.0688.2522.3095.2522m7.1518-.0344c.2522 0 .3324-.1605.3553-.2522.0115-.0343.0115-.0917.0115-.126v-.4929h-.3553v-.5043H24v.917c0 .0687 0 .1145-.0115.2292-.0573.6303-.596.8481-1.2034.8481-.6075 0-1.1461-.2178-1.2034-.8481-.0115-.1147-.0115-.1605-.0115-.2293v-1.444c0-.0574.0115-.172.0115-.2293.0802-.6419.596-.8482 1.2034-.8482s1.1347.2063 1.2034.8482c.0115.1031.0115.2292.0115.2292v.1146h-.8596v-.1948s0-.0803-.0115-.1261c-.0114-.0802-.0802-.2521-.3438-.2521-.2521 0-.321.1604-.3438.2521-.0115.0458-.0115.1032-.0115.1605v1.5702c0 .0458 0 .0916.0115.126 0 .0917.0917.2522.3323.2522"/></svg>`,
  outlook: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-outlook" fill="currentColor"><rect x="1.5" y="3" width="21" height="18" rx="3.5"/><circle cx="9" cy="12" r="3.6" fill="none" stroke="#fff" stroke-width="2.3"/><rect x="14.3" y="8.7" width="6.2" height="6.6" rx="1" fill="#fff"/><path d="M14.6 9.4l2.8 2.5 2.8-2.5" fill="none" stroke="#0078D4" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
  appleprofile: `<svg aria-hidden="true" viewBox="0 0 24 24" class="brand b-ink" fill="currentColor"><g transform="translate(-1.2 -1.2) scale(.9)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></g><circle cx="18.2" cy="18.2" r="5.6" fill="#0A84FF"/><path d="M15.5 18.3l2 2 3.3-3.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mail: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  calendar: S('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>'),
  contacts: S('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
  tasks: S('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7 5M3.5 12l1.5 1.5L7 11M3.5 18l1.5 1.5L7 17"/>'),
  sync: S('<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>'),
  profile: S('<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/><path d="M12 8v6M9.5 11.5L12 14l2.5-2.5"/>'),
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  globe: S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>'),
  warn: S('<path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  copy: S('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
  arrow: S('<path d="M9 6l6 6-6 6"/>', 'width="20" height="20" stroke-width="2.2"'),
  back: S('<path d="M15 6l-6 6 6 6"/>', 'width="18" height="18" stroke-width="2.2"'),
  download: S('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 'width="20" height="20" stroke-width="2.4"'),
  spark: S('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>'),
  image: S('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', 'width="16" height="16"'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>', 'width="16" height="16" stroke-width="2.2"'),
  phone: S('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18.5h2"/>'),
  key: S('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
  send: S('<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>'),
  inbox: S('<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>'),
  cross: S('<path d="M7 7l10 10M17 7L7 17"/>', 'stroke-width="2.6"'),
  bang: S('<path d="M12 6.5v7M12 17.5h.01"/>', 'stroke-width="2.8"'),
  dash: S('<path d="M7 12h10"/>', 'stroke-width="2.6"'),
};
const SERVICE_META = {
  mail: { label: 'Mail', icon: 'mail' },
  calendar: { label: 'Calendrier', icon: 'calendar' },
  contacts: { label: 'Contacts', icon: 'contacts' },
};

/* ---------- Utilitaires ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Même validation que côté serveur (server/validate.js).
const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TLD_RE = /^(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/;
function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const email = raw.trim();
  if (email.length < 6 || email.length > 254) return null;
  const at = email.lastIndexOf('@');
  if (at < 1 || email.indexOf('@') !== at) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (local.length > 64 || !LOCAL_RE.test(local)) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL_RE.test(l)) || !TLD_RE.test(labels[labels.length - 1])) return null;
  return local + '@' + domain;
}
function emailError(raw) {
  const v = raw.trim();
  if (!v) return 'Saisissez votre adresse e-mail.';
  if (!v.includes('@')) return 'Il manque le « @ » (ex. jean@example.com).';
  if (/\s/.test(v)) return 'L’adresse ne doit pas contenir d’espace.';
  if (!normalizeEmail(v)) return 'Cette adresse ne semble pas valide. Vérifiez-la (ex. jean@example.com).';
  return '';
}
const normalizeName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

// Ordinateur avec souris : on propose alors le QR code pour poursuivre sur le téléphone.
function isDesktop() {
  const d = detectDevice();
  if (d === 'ios' || d === 'android') return false;
  // Écran tactile comme pointeur principal (tablette Android déguisée, etc.) : pas de QR.
  return !window.matchMedia || !matchMedia('(pointer: coarse)').matches;
}

function detectDevice() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios'; // iPadOS se présente comme un Mac
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  return null;
}

/* ---------- État ---------- */
const DEFAULT_CFG = {
  brand: 'mccs',
  brandLogoUrl: '',
  davPreset: 'mdaemon',
  organization: '',
  imap: { host: 'mail.example.com', port: 993, security: 'SSL/TLS' },
  smtp: { host: 'mail.example.com', port: 465, security: 'SSL/TLS' },
  caldavUrl: '',
  carddavUrl: '',
  tasksUrl: '',
  davDiscoveryUrl: '',
  davCardDiscoveryUrl: '',
  davTemplates: { principal: '', calendar: '', tasks: '', contacts: '' },
  webmailUrl: '',
  publicUrl: '',
  shots: [],
  support: { email: '', phone: '', hours: '', address: '' },
  links: {},
  connectionTest: false,
  testMessages: { imap: {}, smtp: {} },
};
const state = {
  cfg: DEFAULT_CFG,
  email: '',
  name: '',
  services: new Set(['mail', 'calendar', 'contacts']),
  detected: detectDevice(),
};

// URL DAV personnelle à partir d'un gabarit ({email}, {local}, {domain}) : même logique que server/config.js.
function davUrl(template, email) {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  const enc = (x) => encodeURIComponent(x).replace(/%40/g, '@');
  return String(template || '').replace(/\{email\}/g, enc(local + '@' + domain)).replace(/\{local\}/g, enc(local)).replace(/\{domain\}/g, enc(domain));
}

// Texte réservé à un préréglage DAV : préfixe « [mdaemon] » (voir guides.js).
const PRESET_RE = /^\[(mdaemon|generic)\]\s*/;
const presetOk = (t) => { const m = PRESET_RE.exec(t); return !m || m[1] === state.cfg.davPreset; };

// Lien public pré-rempli (QR code « Scannez avec votre téléphone »).
function phoneLink(device, app) {
  const p = new URLSearchParams();
  if (state.email) p.set('email', state.email);
  if (state.name) p.set('name', state.name);
  if (device) p.set('device', device);
  if (app) p.set('app', app);
  const qs = p.toString();
  return String(state.cfg.publicUrl || location.origin).replace(/\/+$/, '') + '/' + (qs ? '?' + qs : '');
}

// QR code compact, replié par défaut (ordinateur uniquement).
function phoneQr(device, app, open = false) {
  if (!isDesktop() || !state.email) return '';
  let svg;
  try { svg = qrSvg(qrEncode(phoneLink(device, app), 'M'), { title: 'QR code vers cette page pour votre téléphone' }); } catch { return ''; }
  const target = { ios: 'votre iPhone ou iPad', android: 'votre téléphone Android' }[device] || 'un téléphone ou une tablette';
  const hint = device === 'android'
    ? 'Visez le code avec l’appareil photo (ou Google Lens), puis touchez le lien.'
    : 'Visez le code avec l’app <strong>Appareil photo</strong>, puis touchez le lien. Sur iPhone, la page s’ouvre dans Safari, indispensable pour le profil.';
  return `<details class="qr-mini"${open ? ' open' : ''}>
    <summary>${ICONS.phone}<span>Configurer ${target}&nbsp;? <u>Scanner un QR code</u></span></summary>
    <div class="qr-mini-body">
      <div class="qr-code">${svg}</div>
      <p>Cette page s’ouvre sur l’appareil, avec votre adresse déjà remplie. ${hint}</p>
    </div>
  </details>`;
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

// Valeurs copiables : libellé simple + terme technique en petit (tech).
function fieldDefs() {
  const c = state.cfg;
  const who = state.email || 'votre adresse e-mail complète';
  const t = c.davTemplates || DEFAULT_CFG.davTemplates;
  const mine = (k, alias) => (state.email ? davUrl(t[k], state.email) : alias);
  return {
    email: { label: 'Adresse e-mail', value: state.email || 'votre adresse e-mail', copy: !!state.email },
    name: { label: 'Nom affiché', value: state.name || 'votre prénom et nom', copy: !!state.name },
    username: { label: 'Nom d’utilisateur', tech: 'adresse e-mail complète', value: who, copy: !!state.email },
    password: { label: 'Mot de passe', value: 'le mot de passe de votre boîte mail', secret: true },
    imapHost: { label: 'Serveur de réception', tech: 'IMAP', value: c.imap.host },
    imapPort: { label: 'Port de réception', tech: 'IMAP', value: String(c.imap.port) },
    imapSec: { label: 'Sécurité de réception', tech: 'IMAP', value: c.imap.security, copy: false },
    smtpHost: { label: 'Serveur d’envoi', tech: 'SMTP', value: c.smtp.host },
    smtpPort: { label: 'Port d’envoi', tech: 'SMTP', value: String(c.smtp.port) },
    smtpSec: { label: 'Sécurité d’envoi', tech: 'SMTP', value: c.smtp.security, copy: false },
    smtpAuth: { label: 'Authentification à l’envoi', tech: 'SMTP', value: 'Oui, mêmes identifiants', copy: false },
    caldav: { label: state.email ? 'Adresse de votre agenda' : 'Adresse de l’agenda', tech: 'CalDAV', value: mine('calendar', c.caldavUrl) },
    carddav: { label: state.email ? 'Adresse de vos contacts' : 'Adresse des contacts', tech: 'CardDAV', value: mine('contacts', c.carddavUrl) },
    tasks: { label: state.email ? 'Adresse de vos tâches' : 'Adresse des tâches', tech: 'CalDAV', value: mine('tasks', c.tasksUrl) },
    principal: { label: 'Adresse de votre compte', tech: 'principal DAV', value: state.email ? davUrl(t.principal, state.email) : String(t.principal).replace('{email}', 'votre-adresse') },
    davHost: { label: 'Serveur', value: hostOf(c.caldavUrl) },
    davPort: { label: 'Port', value: '443 (SSL activé)', copy: false },
    davDiscovery: { label: 'URL de base', tech: 'découverte', value: c.davDiscoveryUrl },
    davCardDiscovery: { label: 'URL de découverte des contacts', tech: 'CardDAV', value: c.davCardDiscoveryUrl },
    webmail: { label: 'Webmail', value: c.webmailUrl },
  };
}

/* ---------- Rendu ---------- */
function fmt(text) {
  const links = state.cfg.links || {};
  const defs = fieldDefs();
  return text
    .replace(PRESET_RE, '')
    .replace(/\[\[(.+?)\]\]/g, (_, s) => `<span class="ui">${esc(s)}</span>`)
    .replace(/\{email\}/g, `<span class="val">${esc(state.email)}</span>`)
    .replace(/\{brand\}/g, esc(state.cfg.brand))
    .replace(/\{L:(\w+)\}/g, (_, k) => esc(links[k] || '#'))
    .replace(/\{F:(\w+)\}/g, (_, k) => `<span class="val">${esc(defs[k] ? defs[k].value : '')}</span>`);
}

// Une valeur à copier. compact : libellé court et bouton icône (panneau des paramètres).
function kv(key, defs, short = '') {
  const d = defs[key];
  if (!d) return '';
  const canCopy = d.copy !== false && !d.secret;
  const label = short || d.label;
  const tech = short ? '' : d.tech;
  return `<div class="kv${short ? ' kv-compact' : ''}">
    <div class="kv-main"><span class="kv-label">${esc(label)}${tech ? ` <small>${esc(tech)}</small>` : ''}</span><span class="kv-value${d.secret ? ' is-secret' : ''}">${esc(d.value)}</span></div>
    ${canCopy ? `<button type="button" class="copy${short ? ' copy-icon' : ''}" data-copy="${esc(d.value)}" aria-label="Copier : ${esc(d.label)}">${ICONS.copy}<span${short ? ' class="sr-only"' : ''}>Copier</span></button>` : ''}
  </div>`;
}
const fields = (keys) => { const defs = fieldDefs(); return `<div class="fields">${keys.map((k) => kv(k, defs)).join('')}</div>`; };

function tags(covers) {
  return `<span class="tags">${covers.map((s) => `<span class="tag">${ICONS[SERVICE_META[s].icon]}${SERVICE_META[s].label}</span>`).join('')}</span>`;
}

function listFr(words) {
  return words.length < 2 ? words.join('') : words.slice(0, -1).join(', ') + ' et ' + words[words.length - 1];
}

function profileUrl() {
  const p = new URLSearchParams({ email: state.email });
  if (state.name) p.set('name', state.name);
  p.set('services', [...state.services].join(','));
  return '/profile.mobileconfig?' + p.toString();
}

function setStep(n, deviceId = '') {
  const hrefs = { 1: '#/', 2: '#/appareil', 3: deviceId ? '#/appareil/' + deviceId : '' };
  document.querySelectorAll('#stepper li').forEach((li) => {
    const s = Number(li.dataset.step);
    const a = li.querySelector('a');
    li.classList.toggle('done', s < n);
    li.classList.toggle('current', s === n);
    if (s < n && hrefs[s]) a.setAttribute('href', hrefs[s]); else a.removeAttribute('href');
    if (s === n) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
  });
}

function showWizard(html, step, deviceId = '', quiet = false) {
  $('#view-home').hidden = true;
  $('#view-wizard').hidden = false;
  $('#who-email').textContent = state.email;
  setStep(step, deviceId);
  const view = $('#view');
  view.innerHTML = html;
  view.classList.remove('fade-in');
  void view.offsetWidth;
  if (!quiet) view.classList.add('fade-in');
  window.scrollTo({ top: 0, behavior: 'auto' });
  document.querySelector('#view-wizard > .container').classList.remove('wide');
  const h = view.querySelector('[data-focus]') || view.querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

function renderHome() {
  $('#view-wizard').hidden = true;
  $('#view-home').hidden = false;
  showForm();
  if (state.email) $('#email').value = state.email;
  if (state.name) $('#name').value = state.name;
  document.title = 'Configurer ma messagerie · ' + state.cfg.brand;
}

/* ---------- Vérification du mot de passe (option CONNECTION_TEST) ----------
   Le mot de passe n'existe que le temps de l'envoi : lu dans le champ, aussitôt effacé du champ,
   envoyé une fois à /api/test, jamais gardé dans l'état, l'URL, le stockage local ou le QR code. */
const CHECK_LABELS = {
  ok: 'Fonctionne', auth_failed: 'Mot de passe refusé', blocked: 'Accès bloqué', unreachable: 'Serveur injoignable',
  tls_error: 'Connexion sécurisée impossible', timeout: 'Pas de réponse', error: 'Vérification impossible',
  skipped: 'Non vérifié', pending: 'Vérification en cours…', waiting: 'En attente',
};
const CHECK_KIND = { ok: 'ok', auth_failed: 'bad', blocked: 'bad', skipped: 'idle', waiting: 'idle', pending: 'busy' };
const CHECK_ICON = { ok: 'check', bad: 'cross', warn: 'bang', idle: 'dash', busy: '' };
const checkOn = () => state.cfg.connectionTest === true;
let checkRun = 0; // numéro de la vérification en cours (une réponse tardive d'un essai abandonné est ignorée)

// Texte éditable dans l'admin : affiché tel quel (jamais du HTML), un paragraphe par ligne.
const paras = (t, cls = '') => String(t || '').split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x) => `<p${cls ? ` class="${cls}"` : ''}>${esc(x)}</p>`).join('');

function showForm() {
  checkRun++;
  $('#check').hidden = true;
  $('#check').innerHTML = '';
  $('#start-form').hidden = false;
  const pw = $('#password');
  pw.value = '';
  setPasswordVisible(false);
  setBusy(false);
}

function setPasswordVisible(on) {
  const pw = $('#password');
  const btn = $('#password-toggle');
  pw.type = on ? 'text' : 'password';
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('span').textContent = on ? 'Masquer' : 'Afficher';
  btn.setAttribute('aria-label', on ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
}

function setBusy(on) {
  const btn = $('#start-submit');
  btn.disabled = on;
  btn.classList.toggle('is-busy', on);
}

// Accueil selon l'option : champ mot de passe, bouton et mentions.
function applyCheckOption() {
  const on = checkOn();
  $('#password-field').hidden = !on;
  $('#password').disabled = !on;
  $('#skip-check').hidden = !on;
  $('#start-label').textContent = on ? 'Vérifier ma connexion' : 'Continuer';
  $('#home-sub').textContent = on
    ? 'Indiquez votre nom, votre adresse e-mail et son mot de passe. Nous vérifions qu’ils fonctionnent, puis nous vous guidons pas à pas.'
    : 'Indiquez votre nom et votre adresse e-mail. Nous vous guidons ensuite pas à pas.';
  $('#privacy-note').textContent = on
    ? 'Votre mot de passe sert uniquement à vérifier la connexion. Il n’est pas enregistré.'
    : 'Aucun mot de passe demandé. Rien n’est enregistré.';
}

function checkRow(service, status, message) {
  const kind = CHECK_KIND[status] || 'warn';
  const title = service === 'imap' ? 'Réception des e-mails' : 'Envoi des e-mails';
  // Envoi refusé après une réception réussie : le mot de passe est bon, ce sont les droits d'envoi.
  const label = service === 'smtp' && status === 'auth_failed' ? 'Identifiants refusés' : CHECK_LABELS[status] || status;
  return `<li class="check-row is-${kind}">
    <span class="check-svc">${ICONS[service === 'imap' ? 'inbox' : 'send']}</span>
    <div class="check-main">
      <p class="check-line"><span class="check-name">${title}</span><span class="check-state"><span class="check-ic">${CHECK_ICON[kind] ? ICONS[CHECK_ICON[kind]] : ''}</span>${esc(label)}</span></p>
      ${message ? paras(message, 'check-msg') : ''}
    </div>
  </li>`;
}

// Liens d'aide : questions fréquentes, webmail, support.
function checkHelp() {
  const c = state.cfg;
  const sup = c.support || {};
  const items = [`<button type="button" class="link-plain" data-panel="panel-help" aria-haspopup="dialog">${ICONS.info}Aide et questions fréquentes</button>`];
  if (c.webmailUrl) items.push(`<a class="link-plain" href="${esc(c.webmailUrl)}" target="_blank" rel="noopener">${ICONS.globe}Essayer le webmail</a>`);
  if (sup.phone) items.push(`<a class="link-plain" href="${esc(sup.phoneUri || 'tel:' + String(sup.phone).replace(/[^+\d]/g, ''))}">${ICONS.phone}${esc(sup.phone)}</a>`);
  else if (sup.email) items.push(`<a class="link-plain" href="mailto:${esc(sup.email)}">${ICONS.mail}${esc(sup.email)}</a>`);
  return `<div class="check-help">${items.join('')}</div>`;
}

// r : { phase: 'pending' } | { phase: 'result', imap, smtp } | { phase: 'notice', title, message, primary, secondary }
function renderCheck(r) {
  const box = $('#check');
  const m = state.cfg.testMessages || DEFAULT_CFG.testMessages;
  const msg = (svc, st) => ((m[svc] || {})[st] || '');
  const who = `<p class="check-who">${esc(state.email)}</p>`;
  let head;
  let body = '';
  let actions = '';
  if (r.phase === 'pending') {
    head = `<span class="check-badge is-busy" aria-hidden="true"></span><h1 id="check-title" tabindex="-1">Vérification de votre connexion…</h1>${who}`;
    body = `<ul class="check-rows">${checkRow('imap', 'pending', '')}${checkRow('smtp', 'waiting', '')}</ul>`;
    actions = `<p class="check-wait">Cela prend quelques secondes.</p>`;
  } else if (r.phase === 'result') {
    const okIn = r.imap === 'ok';
    const okAll = okIn && r.smtp === 'ok';
    const title = okAll ? 'Votre adresse fonctionne' : okIn ? 'La réception fonctionne, pas l’envoi' : 'La connexion n’a pas abouti';
    head = `<span class="check-badge is-${okAll ? 'ok' : okIn ? 'warn' : 'bad'}" aria-hidden="true">${ICONS[okAll ? 'check' : okIn ? 'bang' : 'cross']}</span><h1 id="check-title" tabindex="-1">${title}</h1>${who}`;
    // Envoi sauté : le message de la réception suffit, la ligne reste courte.
    body = `<ul class="check-rows">${checkRow('imap', r.imap, msg('imap', r.imap))}${checkRow('smtp', r.smtp, r.smtp === 'skipped' ? '' : msg('smtp', r.smtp))}</ul>`;
    actions = okIn
      ? `<button type="button" class="btn btn-primary btn-block" data-check="continue">Continuer${ICONS.arrow}</button>
         ${okAll ? '' : '<p class="check-alt"><button type="button" class="link-plain" data-check="retry">Réessayer</button></p>'}`
      : `<button type="button" class="btn btn-primary btn-block" data-check="retry">Réessayer${ICONS.arrow}</button>
         <p class="check-alt"><button type="button" class="link-plain" data-check="continue">Continuer sans vérifier</button></p>`;
    actions += checkHelp();
  } else {
    head = `<span class="check-badge is-warn" aria-hidden="true">${ICONS.bang}</span><h1 id="check-title" tabindex="-1">${esc(r.title)}</h1>${who}`;
    body = `<div class="check-notice">${paras(r.message)}</div>`;
    actions = `<button type="button" class="btn btn-primary btn-block" data-check="${r.primary[0]}">${esc(r.primary[1])}${ICONS.arrow}</button>
      <p class="check-alt"><button type="button" class="link-plain" data-check="${r.secondary[0]}">${esc(r.secondary[1])}</button></p>${checkHelp()}`;
  }
  box.innerHTML = `<div class="check-head">${head}</div>${body}<div class="check-actions">${actions}</div>`;
  box.hidden = false;
  $('#start-form').hidden = true;
  box.querySelector('h1').focus({ preventScroll: true });
}

async function runCheck() {
  const pw = $('#password');
  const err = $('#password-error');
  const showPwErr = (t) => { err.textContent = t; err.hidden = !t; pw.setAttribute('aria-invalid', t ? 'true' : 'false'); };
  if (!pw.value) { showPwErr('Saisissez le mot de passe de votre boîte mail, ou continuez sans vérifier.'); pw.focus(); return; }
  if (/[\r\n\u0000]/.test(pw.value)) { showPwErr('Ce mot de passe contient un caractère invalide.'); pw.focus(); return; }
  showPwErr('');
  // Lu une fois, effacé du champ tout de suite : il ne sera jamais réaffiché.
  let body = JSON.stringify({ email: state.email, password: pw.value });
  pw.value = '';
  setPasswordVisible(false);
  const run = ++checkRun;
  setBusy(true);
  renderCheck({ phase: 'pending' });
  let res = null;
  let data = {};
  try {
    res = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body, cache: 'no-store', credentials: 'omit' });
    data = await res.json().catch(() => ({}));
  } catch { res = null; }
  body = null;
  setBusy(false);
  if (run !== checkRun) return; // l'utilisateur est revenu au formulaire entre-temps
  const m = state.cfg.testMessages || {};
  if (res && res.status === 200 && data.imap && data.smtp) return renderCheck({ phase: 'result', imap: data.imap.status, smtp: data.smtp.status });
  if (res && res.status === 404) { checkRun++; return go('#/appareil'); } // option désactivée entre-temps
  if (res && res.status === 422 && data.error === 'email') { showForm(); return showEmailError('Cette adresse ne semble pas valide. Vérifiez-la (ex. jean@example.com).'); }
  if (res && res.status === 422) { showForm(); showPwErr('Ce mot de passe contient un caractère invalide.'); return pw.focus(); }
  if (res && res.status === 429) {
    const min = Math.max(1, Math.ceil((Number(data.retryAfter) || 60) / 60));
    return renderCheck({ phase: 'notice', title: 'Patientez avant de réessayer', message: (m.rate_limited || '') + `\nVous pourrez réessayer dans ${min} minute${min > 1 ? 's' : ''}.`, primary: ['continue', 'Continuer sans vérifier'], secondary: ['edit', 'Modifier mon adresse'] });
  }
  if (res && res.status === 403 && data.error === 'domain') {
    return renderCheck({ phase: 'notice', title: 'Adresse non reconnue', message: m.domain || '', primary: ['edit', 'Modifier mon adresse'], secondary: ['continue', 'Continuer sans vérifier'] });
  }
  const why = res ? 'La vérification n’a pas pu se faire pour le moment. Réessayez dans un instant, ou continuez sans vérifier.' : 'Pas de connexion à Internet, ou le service ne répond pas. Vérifiez votre connexion, puis réessayez.';
  renderCheck({ phase: 'notice', title: 'Vérification impossible', message: why, primary: ['retry', 'Réessayer'], secondary: ['continue', 'Continuer sans vérifier'] });
}

function checkAction(what) {
  if (what === 'continue') { checkRun++; renderParams(); go('#/appareil'); return; }
  showForm();
  if (what === 'edit') { $('#email').focus(); $('#email').select(); return; }
  $('#password').focus();
}

function renderDevices() {
  const detected = state.detected;
  const ordered = detected ? [DEVICES.find((d) => d.id === detected), ...DEVICES.filter((d) => d.id !== detected)] : DEVICES;
  const cards = ordered.map((d) => {
    const isDet = d.id === detected;
    return `<a class="device${isDet ? ' is-detected' : ''}" href="#/appareil/${d.id}">
      ${isDet ? '<span class="badge">Cet appareil</span>' : ''}
      <span class="device-icon">${ICONS[d.icon]}</span>
      <span class="device-name">${esc(d.name)}</span>
    </a>`;
  }).join('');
  showWizard(`
    <div class="view-head">
      <h1>Quel appareil voulez-vous configurer&nbsp;?</h1>
    </div>
    <div class="devices">${cards}</div>
    ${phoneQr('', '')}`, 2);
  document.title = 'Choisir l’appareil · ' + state.cfg.brand;
}

// Choix de l'application recommandée (mise en avant) et des applications « suite » (discrètes).
const FOLLOW_UPS = new Set(['caldavsync', 'davx5']);
function recommendedApp(deviceId) {
  const own = APPS[deviceId].find((id) => GUIDES[id].recommended);
  if (own) return own;
  if (deviceId === 'android') return state.detected === 'android' && /Samsung|SM-[A-Z]\d/i.test(navigator.userAgent || '') ? 'samsung' : 'gmail';
  return null;
}

function servicesPicker() {
  const sel = Object.keys(SERVICE_META).filter((k) => state.services.has(k)).map((k) => SERVICE_META[k].label);
  return `<details class="opts">
    <summary>À configurer&nbsp;: <strong id="svc-summary">${esc(listFr(sel))}</strong> <u>Modifier</u></summary>
    <fieldset class="services"><legend class="sr-only">Que voulez-vous configurer ?</legend>
    ${Object.entries(SERVICE_META).map(([k, m]) => `<label class="chip"><input type="checkbox" name="svc" value="${k}"${state.services.has(k) ? ' checked' : ''}><span>${ICONS[m.icon]}${m.label}</span></label>`).join('')}
    </fieldset>
  </details>`;
}

function renderApps(deviceId) {
  const dev = DEVICES.find((d) => d.id === deviceId);
  if (!dev) return go('#/appareil');
  const rec = recommendedApp(deviceId);
  const ids = APPS[deviceId];
  const main = rec ? [rec] : ids.filter((id) => !FOLLOW_UPS.has(id));
  const rest = ids.filter((id) => !main.includes(id));
  const alt = rest.filter((id) => !FOLLOW_UPS.has(id));
  const follow = rest.filter((id) => FOLLOW_UPS.has(id));
  const big = (g) => `<a class="app-card${g.id === rec ? ' is-recommended' : ''}" href="#/guide/${deviceId}/${g.id}">
      ${g.id === rec ? '<span class="badge">Recommandé</span>' : ''}
      <span class="app-icon">${ICONS[g.icon]}</span>
      <span class="app-body"><span class="app-title">${esc(g.name)}</span><span class="app-desc">${esc(g.desc)}</span>${tags(g.covers)}</span>
      ${g.id === rec ? `<span class="btn btn-primary app-go">Commencer${ICONS.arrow}</span>` : `<span class="app-arrow">${ICONS.arrow}</span>`}
    </a>`;
  const small = (g) => `<a class="app-row" href="#/guide/${deviceId}/${g.id}">
      <span class="app-row-icon">${ICONS[g.icon]}</span>
      <span class="app-body"><span class="app-row-title">${esc(g.name)}</span><span class="app-desc">${esc(g.desc)}</span></span>
      <span class="app-arrow">${ICONS.arrow}</span>
    </a>`;
  const title = GUIDES[rec] && GUIDES[rec].profile ? `${esc(dev.name)}&nbsp;: la méthode la plus simple` : `${esc(dev.name)}&nbsp;: quelle application utilisez-vous&nbsp;?`;
  showWizard(`
    <div class="view-head">
      <h1>${title}</h1>
    </div>
    ${deviceId === 'ios' || deviceId === 'android' ? phoneQr(deviceId, '', true) : ''}
    <div class="apps">${main.map((id) => big(GUIDES[id])).join('')}</div>
    ${alt.length ? `<div class="apps-more"><h2>${deviceId === 'android' ? 'Autre application' : 'Autres méthodes'}</h2>${alt.map((id) => small(GUIDES[id])).join('')}</div>` : ''}
    ${follow.length ? `<div class="apps-more"><h2>Pour l’agenda et les contacts</h2>${follow.map((id) => small(GUIDES[id])).join('')}</div>` : ''}
    ${servicesPicker()}
    <p class="view-back"><a href="#/appareil">${ICONS.back}Changer d’appareil</a></p>`, 3, deviceId);
  document.title = dev.name + ' · ' + state.cfg.brand;
  $('#view').querySelectorAll('input[name="svc"]').forEach((cb) => cb.addEventListener('change', () => {
    const checked = [...$('#view').querySelectorAll('input[name="svc"]:checked')].map((x) => x.value);
    if (!checked.length) { cb.checked = true; toast('Choisissez au moins un élément.'); return; }
    state.services = new Set(checked);
    $('#svc-summary').textContent = listFr(Object.keys(SERVICE_META).filter((k) => state.services.has(k)).map((k) => SERVICE_META[k].label));
  }));
}

// Étapes du guide, à plat, selon les services choisis.
function guideSteps(g) {
  const sections = g.sections.filter((s) => s.service === 'all' || state.services.has(s.service) || !g.covers.some((c) => state.services.has(c)));
  const out = [];
  sections.forEach((s) => s.steps.forEach((st) => out.push({ st, section: s })));
  return out;
}

const shotUrl = (st) => ((state.cfg.shots || []).includes(st.shot) ? '/img/guides/' + st.shot : '');

// Capture d'écran de l'étape : colonne image (ordinateur) ou sous le texte (mobile). Clic = ouvrir en grand.
function renderShot(st, g, n) {
  const url = st.shot ? shotUrl(st) : '';
  if (!url) return '';
  const cap = st.shotCaption || `Capture d’écran : ${g.name}, étape ${n}`;
  return `<figure class="gshot">
    <a class="gshot-link" href="${esc(url)}" target="_blank" rel="noopener" title="Ouvrir en grand"><img src="${esc(url)}" alt="${esc(cap)}" decoding="async"></a>
    <figcaption>${esc(cap)}</figcaption>
  </figure>`;
}

const guideLinks = (params = true) => `<p class="guide-links">
    ${params ? `<button type="button" class="link-btn" data-panel="panel-params" aria-haspopup="dialog">${ICONS.gear}Afficher les paramètres manuels</button>` : ''}
    <button type="button" class="link-btn" data-panel="panel-help" aria-haspopup="dialog">${ICONS.info}Besoin d’aide&nbsp;?</button>
  </p>`;

let guideView = { key: '', n: 0 };

function renderGuide(deviceId, guideId, stepParam) {
  const dev = DEVICES.find((d) => d.id === deviceId);
  const g = GUIDES[guideId];
  if (!dev || !g || !APPS[deviceId].includes(guideId)) return go('#/appareil');
  const steps = guideSteps(g);
  const total = steps.length;
  const base = `#/guide/${deviceId}/${guideId}`;
  if (stepParam === 'fin') return renderDone(dev, g, base);
  const target = stepParam === undefined || stepParam === '' ? 1 : Number(stepParam);
  if (!Number.isInteger(target) || target < 1 || target > total) return go(base);

  const n = target;
  const { st, section } = steps[n - 1];
  const first = n === 1;
  const last = n === total;
  const prevHref = first ? `#/appareil/${deviceId}` : n === 2 ? base : `${base}/${n - 1}`;
  const nextHref = last ? `${base}/fin` : `${base}/${n + 1}`;
  const callouts = first ? (g.callouts || []).map((c) => `<div class="callout${c.kind === 'warn' ? ' callout-warn' : ''}">${ICONS[c.kind === 'warn' ? 'warn' : 'info']}<p>${fmt(c.t)}</p></div>`).join('') : '';
  const icon = SERVICE_META[section.service] ? ICONS[SERVICE_META[section.service].icon] : ICONS.gear;
  const shot = renderShot(st, g, n);
  const key = deviceId + '/' + guideId;
  const dir = guideView.key === key && guideView.n && guideView.n !== n ? (n > guideView.n ? 'next' : 'prev') : '';
  guideView = { key, n };

  showWizard(`
    <header class="guide-head">
      <span class="app-icon">${ICONS[g.icon]}</span>
      <div><p class="guide-kicker">${esc(dev.name)}</p><p class="guide-name">${esc(g.name)}</p></div>
    </header>
    ${first ? `<p class="guide-intro">${fmt(g.intro)}</p>${callouts}` : ''}
    <div class="gstepper">
      <section class="card gcard" aria-labelledby="gtitle">
        <div class="gprogress">
          <p class="gprogress-row"><span class="gprogress-sec">${icon}${esc(section.title)}</span><span class="gprogress-n" aria-live="polite">Étape ${n} sur ${total}</span></p>
          <div class="gbar" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${n}" aria-label="Progression"><i data-pct="${Math.round((n / total) * 100)}"></i></div>
        </div>
        <div class="gstage${dir ? ' go-' + dir : ''}">
          <h1 class="sr-only" id="gtitle" data-focus>Étape ${n} sur ${total} : ${esc(section.title)}</h1>
          <div class="gbody${shot ? ' has-shot' : ''}">
            <div class="gmain">
              <p class="gtext">${fmt(st.t)}</p>
              ${st.dl ? `<div class="download-box">
                <a class="btn btn-primary" href="${esc(profileUrl())}" download>${ICONS.download}Télécharger le profil</a>
                <p class="download-meta">Pour <strong>${esc(state.email)}</strong> : ${esc(listFr([...state.services].map((s) => SERVICE_META[s].label)))}. Sans mot de passe.</p>
              </div>` : ''}
              ${st.f ? fields(st.f) : ''}
              ${st.sub ? `<p class="sub">${fmt(st.sub)}</p>` : ''}
            </div>
            ${shot}
          </div>
        </div>
      </section>
      <nav class="gnav" aria-label="Navigation entre les étapes">
        <a class="btn btn-ghost" href="${prevHref}" rel="prev">${ICONS.back}Précédent</a>
        <a class="btn btn-primary" href="${nextHref}" rel="next">${last ? 'Terminer' : 'Suivant'}${last ? ICONS.check : ICONS.arrow}</a>
      </nav>
    </div>
    ${first ? `<p class="gfinish"><a class="link-plain" href="#/appareil/${deviceId}">${ICONS.back}Changer d’application</a></p>` : ''}
    ${guideLinks()}
    ${first && (deviceId === 'ios' || deviceId === 'android') ? phoneQr(deviceId, g.id) : ''}`, 4, deviceId, !!dir);
  document.title = `Étape ${n} sur ${total} · ${g.name} · ${state.cfg.brand}`;
  document.querySelector('#view-wizard > .container').classList.toggle('wide', steps.some((x) => x.st.shot && shotUrl(x.st)));
  document.querySelectorAll('#view .gbar i').forEach((i) => i.style.setProperty('--pct', i.dataset.pct + '%'));
}

function renderDone(dev, g, lastStep) {
  const covered = g.covers.filter((s) => state.services.has(s));
  const list = covered.length ? covered : g.covers;
  const NOUN = { mail: 'vos e-mails', calendar: 'votre agenda', contacts: 'vos contacts' };
  const what = listFr(list.map((s) => NOUN[s]));
  const plural = list.length > 1 || list[0] !== 'calendar';
  const ready = what.charAt(0).toUpperCase() + what.slice(1) + (plural ? ' sont prêts' : ' est prêt');
  const next = g.next && APPS[dev.id].includes(g.next.guide) ? g.next : null;
  const tips = (g.tips || []).filter(presetOk).map((t) => `<li>${fmt(t)}</li>`).join('');
  showWizard(`
    <div class="card done-card">
      <span class="done-icon">${ICONS.check}</span>
      <h1 data-focus>C’est terminé</h1>
      <p class="done-lead">${esc(ready)} sur votre ${esc(dev.name)}.</p>
      ${next ? `<div class="next-card">
        <p><strong>${esc(next.t)}</strong><br>${esc(next.d)}</p>
        <a class="btn btn-primary btn-block" href="#/guide/${dev.id}/${next.guide}">Continuer${ICONS.arrow}</a>
      </div>` : ''}
      <div class="done-actions">
        <a class="btn ${next ? 'btn-ghost' : 'btn-primary'} btn-block" href="#/appareil">Configurer un autre appareil</a>
        <a class="link-plain" href="${lastStep}">${ICONS.back}Revoir les étapes</a>
      </div>
      ${tips ? `<details class="tips"><summary>Bon à savoir</summary><ul>${tips}</ul></details>` : ''}
    </div>
    ${guideLinks(false)}`, 5, dev.id);
  document.title = 'C’est terminé · ' + state.cfg.brand;
}

function renderParams() {
  const defs = fieldDefs();
  const group = (title, tech, icon, rows) => `<section class="pgroup">
    <h3>${ICONS[icon]}${esc(title)}${tech ? ` <small>${esc(tech)}</small>` : ''}</h3>
    ${rows.map(([k, short]) => kv(k, defs, short)).join('')}
  </section>`;
  $('#params').innerHTML =
    group('Identifiants', '', 'key', [['username', 'Nom d’utilisateur'], ['password', 'Mot de passe']]) +
    group('Réception des e-mails', 'IMAP', 'mail', [['imapHost', 'Serveur'], ['imapPort', 'Port'], ['imapSec', 'Sécurité']]) +
    group('Envoi des e-mails', 'SMTP', 'mail', [['smtpHost', 'Serveur'], ['smtpPort', 'Port'], ['smtpSec', 'Sécurité'], ['smtpAuth', 'Authentification']]) +
    group('Agenda', 'CalDAV', 'calendar', [['caldav', 'Agenda'], ['tasks', 'Tâches'], ['davDiscovery', 'Découverte']]) +
    group('Contacts', 'CardDAV', 'contacts', [['carddav', 'Contacts'], ['davCardDiscovery', 'Découverte']]) +
    group('Webmail', '', 'globe', [['webmail', 'Adresse']]);
  $('#params-lead').textContent = state.email
    ? `Pour ${state.email}. Utiles seulement si vous configurez sans le guide.`
    : `Valables pour toutes les adresses ${state.cfg.brand}. Indiquez votre adresse pour obtenir vos adresses d’agenda et de contacts.`;
}

function applyConfigToStatic() {
  const c = state.cfg;
  const sup = c.support || {};
  const show = (el, on) => { if (el) el.hidden = !on; };
  // Lien tel: calculé par le serveur (poste en « ;ext= ») ; repli pour une configuration plus ancienne.
  const tel = sup.phoneUri || 'tel:' + String(sup.phone || '').replace(/[^+\d]/g, '');
  document.querySelectorAll('.js-brand-name').forEach((e) => { e.textContent = c.brand; });
  document.querySelectorAll('.js-org').forEach((e) => { e.textContent = c.organization || c.brand; });
  const logo = c.brandLogoUrl;
  document.querySelectorAll('.js-brand-logo').forEach((img) => {
    if (logo) { img.src = logo; img.alt = c.brand; }
    show(img, !!logo);
  });
  // Avec un logo, le nom reste lisible par les lecteurs d'écran (alt) : on masque l'icône et le texte.
  document.querySelectorAll('.js-brand-mark').forEach((e) => show(e, !logo));
  document.querySelectorAll('.brand > .js-brand-name').forEach((e) => show(e, !logo));
  document.querySelectorAll('[data-preset]').forEach((e) => show(e, e.dataset.preset === c.davPreset));
  document.querySelectorAll('.js-webmail').forEach((a) => { a.href = c.webmailUrl; });
  document.querySelectorAll('.js-imap-host').forEach((e) => { e.textContent = c.imap.host; });
  document.querySelectorAll('.js-smtp').forEach((e) => { e.textContent = `${c.smtp.host}, port ${c.smtp.port}, ${c.smtp.security}`; });
  document.querySelectorAll('.js-dav-discovery').forEach((e) => { e.textContent = c.davDiscoveryUrl; });
  document.querySelectorAll('.js-support-phone').forEach((a) => { a.href = tel; (a.querySelector('.t') || a).textContent = sup.phone || ''; show(a, !!sup.phone); });
  document.querySelectorAll('.js-support-email').forEach((a) => { a.href = 'mailto:' + (sup.email || ''); (a.querySelector('.t') || a).textContent = sup.email || ''; show(a, !!sup.email); });
  const phone = $('#support-phone');
  if (phone) { phone.href = tel; phone.querySelector('span').textContent = sup.phone || ''; show(phone, !!sup.phone); }
  const mail = $('#support-email');
  if (mail) { mail.href = 'mailto:' + (sup.email || ''); mail.querySelector('span').textContent = sup.email || ''; show(mail, !!sup.email); }
  const hours = $('#support-hours');
  if (hours) { hours.textContent = sup.hours || ''; show(hours, !!sup.hours); }
  const addr = $('#support-address');
  if (addr) { addr.textContent = sup.address || ''; show(addr, !!sup.address); }
  show($('#support-box'), !!(sup.phone || sup.email || sup.hours || sup.address));
}

/* ---------- Panneaux (paramètres, aide) : <dialog> modal ---------- */
let panelOpener = null;
const openDialog = () => document.querySelector('dialog.panel[open]');
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function openPanel(id, opener) {
  const dlg = document.getElementById(id);
  if (!dlg || dlg.open) return;
  const cur = openDialog();
  if (cur) cur.close('swap');
  panelOpener = opener || document.activeElement;
  dlg.showModal();
  dlg.querySelector('.panel-body').scrollTop = 0;
  dlg.querySelector('[data-close]').focus();
  // Le bouton « retour » du téléphone ferme le panneau au lieu de quitter l'étape.
  if (!(history.state && history.state.panel)) history.pushState({ panel: id }, '', location.href);
}

function bindPanels() {
  document.querySelectorAll('dialog.panel').forEach((dlg) => {
    dlg.addEventListener('close', () => {
      if (dlg.returnValue === 'swap') { dlg.returnValue = ''; return; }
      if (history.state && history.state.panel) history.back();
      if (panelOpener && document.contains(panelOpener)) panelOpener.focus();
      panelOpener = null;
    });
    // Clic sur le fond (hors du panneau) : fermeture.
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const items = [...dlg.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  });
  window.addEventListener('popstate', () => {
    const dlg = openDialog();
    if (dlg && !(history.state && history.state.panel)) { dlg.returnValue = 'pop'; dlg.close(); }
  });
}

/* ---------- Navigation ---------- */
function syncUrl(device = '', app = '') {
  const p = new URLSearchParams(location.search);
  if (state.email) p.set('email', state.email); else p.delete('email');
  if (state.name) p.set('name', state.name); else p.delete('name');
  if (device) p.set('device', device); else p.delete('device');
  if (app) p.set('app', app); else p.delete('app');
  const qs = p.toString();
  history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}
function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}
function route() {
  if (!location.hash.includes('/guide/')) guideView = { key: '', n: 0 };
  const dlg = openDialog();
  if (dlg) dlg.close();
  const h = location.hash;
  if (!h.startsWith('#/')) { if (!h) renderHome(); return; }
  const parts = h.slice(2).split('/').filter(Boolean);
  if (!parts.length || !state.email) return renderHome();
  // Garde ?device= et ?app= alignés sur l'écran affiché (lien partageable).
  const dev = parts[0] === 'appareil' || parts[0] === 'guide' ? parts[1] || '' : '';
  syncUrl(DEVICES.some((d) => d.id === dev) ? dev : '', parts[0] === 'guide' && GUIDES[parts[2]] ? parts[2] : '');
  if (parts[0] === 'appareil' && parts.length === 1) return renderDevices();
  if (parts[0] === 'appareil' && parts[1]) return renderApps(parts[1]);
  if (parts[0] === 'guide' && parts[1] && parts[2]) return renderGuide(parts[1], parts[2], parts[3]);
  renderHome();
}

/* ---------- Copie ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* repli ci-dessous */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.className = 'sr-copy';
  (openDialog() || document.body).appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/* ---------- Démarrage ---------- */
function showEmailError(msg) {
  const err = $('#email-error');
  err.textContent = msg;
  err.hidden = !msg;
  $('#email').setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (msg) $('#email').focus();
}

function bind() {
  const form = $('#start-form');
  const emailInput = $('#email');
  const err = $('#email-error');
  // Adresse et nom validés puis retenus ; false si l'adresse est invalide.
  const takeAddress = () => {
    const msg = emailError(emailInput.value);
    showEmailError(msg);
    if (msg) return false;
    state.email = normalizeEmail(emailInput.value);
    state.name = normalizeName($('#name').value);
    syncUrl();
    renderParams();
    return true;
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#start-submit').disabled || !takeAddress()) return;
    if (checkOn()) { runCheck(); return; }
    go('#/appareil');
  });
  $('#skip-check-btn').addEventListener('click', () => {
    if (!takeAddress()) return;
    $('#password').value = '';
    go('#/appareil');
  });
  $('#password-toggle').addEventListener('click', () => { setPasswordVisible($('#password').type === 'password'); $('#password').focus(); });
  $('#password').addEventListener('input', () => { const pe = $('#password-error'); if (!pe.hidden) { pe.hidden = true; $('#password').setAttribute('aria-invalid', 'false'); } });
  $('#check').addEventListener('click', (e) => { const b = e.target.closest('[data-check]'); if (b) checkAction(b.dataset.check); });
  emailInput.addEventListener('input', () => { if (!err.hidden && !emailError(emailInput.value)) showEmailError(''); });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (btn) {
      const ok = await copyText(btn.dataset.copy);
      if (ok) {
        btn.classList.add('is-done');
        btn.querySelector('span').textContent = 'Copié';
        btn.firstElementChild.outerHTML = ICONS.check;
        toast('Copié : ' + btn.dataset.copy);
        setTimeout(() => {
          btn.classList.remove('is-done');
          btn.querySelector('span').textContent = 'Copier';
          btn.firstElementChild.outerHTML = ICONS.copy;
        }, 1800);
      } else {
        toast('Copie impossible : sélectionnez le texte manuellement.');
      }
      return;
    }
    const pb = e.target.closest('[data-panel]');
    if (pb) { openPanel(pb.dataset.panel, pb); return; }
    const cb = e.target.closest('[data-close]');
    if (cb) { const d = cb.closest('dialog'); if (d) d.close(); }
  });

  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    if (openDialog() || !document.querySelector('.gnav')) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    const a = document.querySelector(e.key === 'ArrowLeft' ? '.gnav [rel="prev"]' : '.gnav [rel="next"]');
    if (a) { e.preventDefault(); location.hash = a.getAttribute('href'); }
  });
  bindPanels();
}

async function init() {
  const q = new URLSearchParams(location.search);
  const qEmail = normalizeEmail(q.get('email') || '');
  if (qEmail) state.email = qEmail;
  else if (q.get('email')) $('#email').value = q.get('email');
  state.name = normalizeName(q.get('name') || '');
  // Après un rechargement, un éventuel état « panneau ouvert » de l'historique n'a plus de sens.
  if (history.state && history.state.panel) history.replaceState(null, '', location.href);
  bind();
  try {
    const r = await fetch('/api/config', { headers: { Accept: 'application/json' } });
    if (r.ok) state.cfg = Object.assign({}, DEFAULT_CFG, await r.json());
  } catch { /* valeurs par défaut */ }
  applyConfigToStatic();
  applyCheckOption();
  renderParams();
  // Lien direct du support (?email=…&device=…&app=…) : on ouvre directement l'écran demandé.
  if (state.email && !location.hash.startsWith('#/')) {
    const dev = q.get('device');
    const app = q.get('app');
    let hash = '#/appareil';
    if (dev && APPS[dev]) hash = APPS[dev].includes(app) ? `#/guide/${dev}/${app}` : `#/appareil/${dev}`;
    history.replaceState(null, '', location.pathname + location.search + hash);
  }
  route();
}

init();
