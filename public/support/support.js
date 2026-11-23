// Vue « Liens clients » de l'espace d'administration : lien pré-rempli et QR code.
// Importé par admin.js (la page /support exige une session côté serveur).
import { DEVICES, APPS, GUIDES } from '/js/guides.js';
import { encode, toSvg, toCanvas } from '/js/qr.js';

const $ = (s) => document.querySelector(s);

// Même validation que server/validate.js et public/js/app.js.
const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TLD_RE = /^(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/;
function normalizeEmail(raw) {
  const email = String(raw || '').trim();
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
const normalizeName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

let cfg = {
  brand: 'mccs',
  brandLogoUrl: '',
  publicUrl: location.origin,
};
let current = null; // { link, email, name, device, app, qr }
let generated = false;

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function fillApps() {
  const dev = $('#s-device').value;
  const sel = $('#s-app');
  sel.innerHTML = '<option value="">Au choix du client</option>';
  sel.disabled = !dev;
  if (!dev) return;
  for (const id of APPS[dev]) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = GUIDES[id].name;
    sel.appendChild(o);
  }
}

function buildLink({ email, name, device, app }) {
  const p = new URLSearchParams({ email });
  if (name) p.set('name', name);
  if (device) p.set('device', device);
  if (device && app) p.set('app', app);
  return String(cfg.publicUrl).replace(/\/+$/, '') + '/?' + p.toString();
}

function applyBrand() {
  document.querySelectorAll('.js-brand-name').forEach((e) => { e.textContent = cfg.brand; });
  const logo = cfg.brandLogoUrl;
  document.querySelectorAll('.js-brand-logo').forEach((img) => { if (logo) { img.src = logo; img.alt = cfg.brand; } img.hidden = !logo; });
  document.querySelectorAll('.js-brand-mark, .brand > .js-brand-name').forEach((e) => { e.hidden = !!logo; });
  document.title = 'Administration · ' + cfg.brand;
}

function render() {
  const emailInput = $('#s-email');
  const err = $('#s-email-error');
  const email = normalizeEmail(emailInput.value);
  if (!email) {
    const v = emailInput.value.trim();
    err.textContent = !v ? 'Saisissez l’adresse e-mail du client.' : 'Cette adresse ne semble pas valide.';
    err.hidden = false;
    emailInput.setAttribute('aria-invalid', 'true');
    return false;
  }
  err.hidden = true;
  emailInput.setAttribute('aria-invalid', 'false');
  const data = {
    email,
    name: normalizeName($('#s-name').value),
    device: $('#s-device').value,
    app: $('#s-app').value,
  };
  data.link = buildLink(data);
  data.qr = encode(data.link, 'M');
  current = data;

  $('#r-who').textContent = data.name ? `${data.name} <${email}>` : email;
  const a = $('#r-link');
  a.href = data.link;
  a.textContent = data.link;
  $('#r-qr').innerHTML = toSvg(data.qr, { title: 'QR code : ' + data.link });

  $('#sup-result').classList.remove('is-empty');
  return true;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileBase = () => 'qr-' + current.email.replace(/[^A-Za-z0-9._-]+/g, '_');

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* repli */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.className = 'sr-copy';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

// Recharge la configuration publique (nom, logo, adresse publique) après un enregistrement.
export function reloadConfig() {
  return fetch('/api/config', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => { if (c) { cfg = Object.assign(cfg, c); applyBrand(); if (generated) render(); } })
    .catch(() => {});
}

export function initLinks() {
  const devSel = $('#s-device');
  for (const d of DEVICES) {
    const o = document.createElement('option');
    o.value = d.id;
    o.textContent = d.name;
    devSel.appendChild(o);
  }
  devSel.addEventListener('change', () => { fillApps(); if (generated) render(); });
  $('#sup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (render()) {
      generated = true;
      if (matchMedia('(max-width: 979px)').matches) $('#sup-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else $('#s-email').focus();
  });
  // Une fois le premier lien généré, il suit les modifications du formulaire.
  for (const id of ['#s-email', '#s-name', '#s-app']) {
    $(id).addEventListener(id === '#s-app' ? 'change' : 'input', () => {
      if (!generated) return;
      if (id === '#s-email' && !normalizeEmail($('#s-email').value)) return;
      render();
    });
  }
  $('#r-copy').addEventListener('click', async () => {
    if (!current) return;
    toast((await copyText(current.link)) ? 'Lien copié.' : 'Copie impossible : sélectionnez le lien manuellement.');
  });
  $('#r-svg').addEventListener('click', () => {
    if (!current) return;
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + toSvg(current.qr, { dark: '#000000' }).replace('<svg ', '<svg width="400" height="400" ');
    download(new Blob([svg], { type: 'image/svg+xml' }), fileBase() + '.svg');
  });
  $('#r-png').addEventListener('click', () => {
    if (!current) return;
    const canvas = toCanvas(current.qr, document.createElement('canvas'), { scale: 12, dark: '#000000' });
    canvas.toBlob((b) => { if (b) download(b, fileBase() + '.png'); else toast('Export PNG impossible.'); }, 'image/png');
  });

  return reloadConfig();
}
