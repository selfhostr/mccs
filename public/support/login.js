// Page de connexion de l'espace d'administration (servie sans session : aucun autre module importé).
const $ = (s) => document.querySelector(s);
const form = $('#login-form');
const alertBox = $('#login-alert');
const submit = $('#login-submit');
let unlockTimer;

function showAlert(msg, kind = 'error') {
  alertBox.textContent = msg || '';
  alertBox.hidden = !msg;
  alertBox.className = 'login-alert' + (kind === 'info' ? ' is-info' : '');
}

function busy(on) {
  submit.disabled = on;
  submit.classList.toggle('is-busy', on);
}

// Bloque le bouton pendant le verrouillage, puis le réactive.
function lock(seconds) {
  const min = Math.max(1, Math.ceil(seconds / 60));
  showAlert(`Trop d’essais. Réessayez dans ${min} minute${min > 1 ? 's' : ''}.`);
  submit.disabled = true;
  clearTimeout(unlockTimer);
  unlockTimer = setTimeout(() => { submit.disabled = false; showAlert(''); }, Math.min(seconds, 3600) * 1000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = $('#user').value.trim();
  const password = $('#password').value;
  if (!user || !password) {
    showAlert(!user ? 'Saisissez votre identifiant.' : 'Saisissez votre mot de passe.');
    (!user ? $('#user') : $('#password')).focus();
    return;
  }
  busy(true);
  showAlert('');
  let res;
  let data = {};
  try {
    res = await fetch('/support/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ user, password }),
    });
    try { data = await res.json(); } catch { data = {}; }
  } catch {
    busy(false);
    showAlert('Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.');
    return;
  }
  busy(false);
  if (res.ok && data.ok) { location.replace('/support/'); return; }
  if (res.status === 429) {
    const header = Number(res.headers.get('Retry-After'));
    lock(Number(data.retryAfter) || header || 900);
    return;
  }
  if (res.status === 401) {
    showAlert('Identifiant ou mot de passe incorrect.');
    $('#password').select();
    $('#password').focus();
    return;
  }
  if (res.status === 404) { showAlert('L’espace d’administration est désactivé sur ce serveur (aucun mot de passe défini).'); return; }
  showAlert(`Connexion impossible (erreur ${res.status}). Réessayez dans un instant.`);
});

$('#pw-toggle').addEventListener('click', () => {
  const input = $('#password');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  $('#pw-toggle').textContent = show ? 'Masquer' : 'Afficher';
  $('#pw-toggle').setAttribute('aria-pressed', String(show));
  input.focus();
});

if (new URLSearchParams(location.search).has('expire')) showAlert('Votre session a expiré. Reconnectez-vous pour continuer.', 'info');

// Nom et logo de l'instance (configuration publique).
fetch('/api/config', { headers: { Accept: 'application/json' } })
  .then((r) => (r.ok ? r.json() : null))
  .then((c) => {
    if (!c) return;
    document.querySelectorAll('.js-brand-name').forEach((el) => { el.textContent = c.brand; });
    const logo = c.brandLogoUrl;
    document.querySelectorAll('.js-brand-logo').forEach((img) => { if (logo) { img.src = logo; img.alt = c.brand; } img.hidden = !logo; });
    document.querySelectorAll('.js-brand-mark').forEach((el) => { el.hidden = Boolean(logo); });
    if (logo) document.querySelectorAll('.login-brand .js-brand-name').forEach((el) => { el.hidden = true; });
    document.title = 'Connexion · Administration ' + c.brand;
  })
  .catch(() => {});

$('#user').focus();
