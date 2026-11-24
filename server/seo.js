'use strict';

// Référencement de la page d'accueil : <head> (titre, description, robots, canonique, Open Graph,
// carte Twitter, JSON-LD), robots.txt et sitemap.xml. Fonctions pures de la configuration (server/config.js),
// recalculées par refresh() dans server/index.js à chaque enregistrement des réglages.

const DEFAULT_TITLE = 'Configurer ma messagerie';
const DEFAULT_DESCRIPTION = 'Configurez votre e-mail, votre calendrier et vos contacts sur PC, Mac, iPhone, iPad et Android, étape par étape.';
const defaultTitle = (brand) => DEFAULT_TITLE + ' · ' + brand;

const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => HTML_ESC[c]);
// JSON placé dans <script type="application/ld+json"> : aucun « < » (donc jamais de </script>), ni & ou >,
// ni séparateurs de ligne Unicode.
const ldJson = (obj) => JSON.stringify(obj).replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

// Adresse absolue d'une ressource : déjà absolue, ou chemin local préfixé par PUBLIC_URL (sinon inconnue).
function absolute(config, p) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith('/') && config.publicUrl ? config.publicUrl + p : '';
}

// Image de partage : SEO_IMAGE, sinon le logo de la marque s'il n'est pas en SVG (ignoré par les réseaux sociaux).
function shareImage(config) {
  if (config.seo.image) return { url: absolute(config, config.seo.image), large: true };
  const logo = config.brandLogoUrl;
  if (logo && !/\.svg(?:[?#]|$)/i.test(logo)) return { url: absolute(config, logo), large: false };
  return { url: '', large: false };
}

const homeUrl = (config) => (config.publicUrl ? config.publicUrl + '/' : '');

function structuredData(config) {
  const url = homeUrl(config);
  const id = (frag) => (url ? url + frag : frag);
  const site = { '@type': 'WebSite', '@id': id('#website'), name: config.brand, description: config.seo.description, inLanguage: 'fr', publisher: { '@id': id('#organization') } };
  const org = { '@type': 'Organization', '@id': id('#organization'), name: config.profile.org };
  if (url) { site.url = url; org.url = url; }
  const logo = absolute(config, config.brandLogoUrl);
  if (logo) org.logo = logo;
  const { phone, email } = config.support;
  if (phone || email) {
    org.contactPoint = Object.assign({ '@type': 'ContactPoint', contactType: 'customer support' },
      phone ? { telephone: phone } : {}, email ? { email } : {}, { availableLanguage: 'fr' });
  }
  return { '@context': 'https://schema.org', '@graph': [site, org] };
}

// Lignes du <head> qui dépendent des réglages.
function renderHead(config) {
  const { title, description, index } = config.seo;
  const url = homeUrl(config);
  const image = shareImage(config);
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta name="robots" content="${index ? 'index, follow' : 'noindex, nofollow'}">`,
  ];
  if (url) lines.push(`<link rel="canonical" href="${esc(url)}">`);
  lines.push(
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${esc(config.brand)}">`,
    '<meta property="og:locale" content="fr_FR">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`);
  if (url) lines.push(`<meta property="og:url" content="${esc(url)}">`);
  if (image.url) lines.push(`<meta property="og:image" content="${esc(image.url)}">`);
  lines.push(`<meta name="twitter:card" content="${image.url && image.large ? 'summary_large_image' : 'summary'}">`);
  lines.push(`<script type="application/ld+json">${ldJson(structuredData(config))}</script>`);
  return lines.join('\n  ');
}

// Remplace le bloc <!-- seo --> … <!-- /seo --> de public/index.html.
const BLOCK_RE = /<!-- seo -->[\s\S]*?<!-- \/seo -->/;
function injectHead(html, head) {
  return html.replace(BLOCK_RE, () => '<!-- seo -->\n  ' + head + '\n  <!-- /seo -->');
}

function robotsTxt(config) {
  if (!config.seo.index) return 'User-agent: *\nDisallow: /\n';
  let txt = 'User-agent: *\nAllow: /\nDisallow: /support\n';
  if (config.publicUrl) txt += `\nSitemap: ${config.publicUrl}/sitemap.xml\n`;
  return txt;
}

// La page d'accueil seule : les guides (#/guide/…) sont des fragments de cette même page.
function sitemapXml(config) {
  if (!config.seo.index || !config.publicUrl) return null;
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <url><loc>${esc(homeUrl(config))}</loc></url>\n` +
    '</urlset>\n';
}

module.exports = { DEFAULT_TITLE, DEFAULT_DESCRIPTION, defaultTitle, renderHead, injectHead, robotsTxt, sitemapXml, absolute };
