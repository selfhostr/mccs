'use strict';

// Feuille de marque générée (accent, fond de page), servie en /brand.css : fichier séparé plutôt
// qu'un style inline, pour respecter la CSP (style-src 'self'). Fonction pure de la configuration,
// reprise aussi par la démo statique (tools/build-demo.js).
function brandCss(config) {
  const rules = [];
  if (config.brandAccent) rules.push(`--accent: ${config.brandAccent};`, '--accent-on: #ffffff;');
  const bg = config.brandBackground;
  if (/^#[0-9a-f]+,#[0-9a-f]+$/i.test(bg)) { const [a, b] = bg.split(','); rules.push(`--brand-bg: linear-gradient(160deg, ${a}, ${b});`); }
  else if (bg.startsWith('#')) rules.push(`--brand-bg: ${bg};`);
  else if (bg.startsWith('/uploads/')) rules.push(`--brand-bg: center / cover no-repeat url("${bg}"), var(--bg);`);
  return `:root { ${rules.join(' ')} }\n`;
}

module.exports = { brandCss };
