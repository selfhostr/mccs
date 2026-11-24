'use strict';

// Référencement : réglages SEO_*, rendu du <head> de la page d'accueil, robots.txt et sitemap.xml.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateValues, FIELDS } = require('../server/settings');
const { createSettings } = require('../server/config');
const { renderHead, injectHead, robotsTxt, sitemapXml, DEFAULT_TITLE, DEFAULT_DESCRIPTION } = require('../server/seo');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mccs-seo-'));
const configOf = (env) => createSettings({ env, dir: tmp() }).config;
const meta = (html, attr, name) => {
  const m = new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`).exec(html);
  return m ? m[1] : null;
};
const jsonLd = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);

/* ---------- Réglages ---------- */

test('réglages : groupe « seo », indexation désactivée par défaut', () => {
  const by = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
  for (const k of ['SEO_INDEX', 'SEO_TITLE', 'SEO_DESCRIPTION', 'SEO_IMAGE']) assert.equal(by[k] && by[k].group, 'seo', k);
  assert.equal(by.SEO_INDEX.type, 'toggle');
  assert.equal(by.SEO_INDEX.default, 'false');
  assert.equal(by.SEO_DESCRIPTION.default, DEFAULT_DESCRIPTION);
  assert.deepEqual([by.SEO_TITLE.max, ...by.SEO_TITLE.advice], [80, 30, 60]);
  assert.deepEqual([by.SEO_DESCRIPTION.max, ...by.SEO_DESCRIPTION.advice], [200, 120, 160]);
});

test('SEO_INDEX : « true » ou « false » seulement', () => {
  assert.deepEqual(validateValues({ SEO_INDEX: 'true' }), {});
  assert.deepEqual(validateValues({ SEO_INDEX: 'false' }), {});
  for (const bad of ['oui', '1', 'TRUE']) assert.ok(validateValues({ SEO_INDEX: bad }).SEO_INDEX, bad);
});

test('SEO_TITLE et SEO_DESCRIPTION : une ligne, longueur maximale, aucun caractère de contrôle', () => {
  assert.deepEqual(validateValues({ SEO_TITLE: 'Configurer sa messagerie Acme', SEO_DESCRIPTION: 'É'.repeat(200) }), {});
  assert.deepEqual(validateValues({ SEO_TITLE: 'x'.repeat(80) }), {});
  assert.match(validateValues({ SEO_TITLE: 'x'.repeat(81) }).SEO_TITLE, /80/);
  assert.match(validateValues({ SEO_DESCRIPTION: 'x'.repeat(201) }).SEO_DESCRIPTION, /200/);
  for (const bad of ['a\nb', 'a\tb', 'a\u0000b', 'a\u0085b', 'a\u2028b']) {
    assert.ok(validateValues({ SEO_TITLE: bad }).SEO_TITLE, JSON.stringify(bad));
    assert.ok(validateValues({ SEO_DESCRIPTION: bad }).SEO_DESCRIPTION, JSON.stringify(bad));
  }
  // Les caractères hors BMP comptent pour un.
  assert.deepEqual(validateValues({ SEO_TITLE: '𝔸'.repeat(80) }), {});
});

test('SEO_IMAGE : image envoyée, image locale ou adresse http(s), pas de SVG', () => {
  for (const ok of ['/uploads/share-0123456789abcdef.png', '/uploads/share-0123456789abcdef.webp', '/img/partage.jpg', 'https://cdn.acme.example/og.png']) {
    assert.deepEqual(validateValues({ SEO_IMAGE: ok }), {}, ok);
  }
  for (const bad of ['javascript:alert(1)', '/etc/passwd', '/uploads/share.svg', 'uploads/x.png', '/img/a b.png']) {
    assert.ok(validateValues({ SEO_IMAGE: bad }).SEO_IMAGE, bad);
  }
});

test('configuration : titre « Configurer ma messagerie · marque » et description intégrée par défaut', () => {
  const c = configOf({ BRAND_NAME: 'Acme' });
  assert.deepEqual(c.seo, { index: false, title: DEFAULT_TITLE + ' · Acme', description: DEFAULT_DESCRIPTION, image: '' });
  const d = configOf({ SEO_INDEX: 'on', SEO_TITLE: 'T', SEO_DESCRIPTION: 'D', SEO_IMAGE: '/uploads/share-0123456789abcdef.png' });
  assert.deepEqual(d.seo, { index: true, title: 'T', description: 'D', image: '/uploads/share-0123456789abcdef.png' });
});

test('describe : valeur effective des réglages SEO', () => {
  const { settings } = createSettings({ env: { BRAND_NAME: 'Acme' }, dir: tmp() });
  const by = Object.fromEntries(settings.describe().map((f) => [f.key, f]));
  assert.equal(by.SEO_TITLE.effective, 'Configurer ma messagerie · Acme');
  assert.equal(by.SEO_INDEX.effective, 'false');
  assert.equal(by.SEO_DESCRIPTION.effective, DEFAULT_DESCRIPTION);
});

/* ---------- <head> de la page d'accueil ---------- */

test('head : par défaut, noindex, sans adresse canonique ni image tant que PUBLIC_URL est vide', () => {
  const html = renderHead(configOf({ BRAND_NAME: 'Acme' }));
  assert.match(html, /<title>Configurer ma messagerie · Acme<\/title>/);
  assert.equal(meta(html, 'name', 'description'), DEFAULT_DESCRIPTION);
  assert.equal(meta(html, 'name', 'robots'), 'noindex, nofollow');
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.equal(meta(html, 'property', 'og:url'), null);
  assert.equal(meta(html, 'property', 'og:image'), null);
  assert.equal(meta(html, 'property', 'og:type'), 'website');
  assert.equal(meta(html, 'property', 'og:site_name'), 'Acme');
  assert.equal(meta(html, 'property', 'og:locale'), 'fr_FR');
  assert.equal(meta(html, 'name', 'twitter:card'), 'summary');
});

test('head : indexation, adresse canonique et image de partage absolues avec PUBLIC_URL', () => {
  const html = renderHead(configOf({
    BRAND_NAME: 'Acme', PUBLIC_URL: 'https://config.acme.example/', SEO_INDEX: 'true',
    SEO_TITLE: 'Messagerie Acme', SEO_DESCRIPTION: 'Aide', SEO_IMAGE: '/uploads/share-0123456789abcdef.png',
  }));
  assert.equal(meta(html, 'name', 'robots'), 'index, follow');
  assert.match(html, /<link rel="canonical" href="https:\/\/config\.acme\.example\/">/);
  assert.equal(meta(html, 'property', 'og:url'), 'https://config.acme.example/');
  assert.equal(meta(html, 'property', 'og:title'), 'Messagerie Acme');
  assert.equal(meta(html, 'property', 'og:description'), 'Aide');
  assert.equal(meta(html, 'property', 'og:image'), 'https://config.acme.example/uploads/share-0123456789abcdef.png');
  assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
});

test('head : sans image de partage, le logo de la marque sert de repli (carte « summary »)', () => {
  let html = renderHead(configOf({ PUBLIC_URL: 'https://c.acme.example', BRAND_LOGO_URL: '/uploads/logo-0123456789abcdef.png' }));
  assert.equal(meta(html, 'property', 'og:image'), 'https://c.acme.example/uploads/logo-0123456789abcdef.png');
  assert.equal(meta(html, 'name', 'twitter:card'), 'summary');
  // Un logo SVG n'est pas affiché par les réseaux sociaux : pas d'image.
  html = renderHead(configOf({ PUBLIC_URL: 'https://c.acme.example', BRAND_LOGO_URL: '/img/logo.svg' }));
  assert.equal(meta(html, 'property', 'og:image'), null);
  // Une image externe est déjà absolue, même sans PUBLIC_URL.
  html = renderHead(configOf({ SEO_IMAGE: 'https://cdn.acme.example/og.png' }));
  assert.equal(meta(html, 'property', 'og:image'), 'https://cdn.acme.example/og.png');
});

test('head : tout est échappé (HTML et JSON-LD)', () => {
  const evil = 'A"<script>alert(1)</script>&\'';
  const html = renderHead(configOf({ BRAND_NAME: evil, PROFILE_ORGANIZATION: evil, SEO_TITLE: evil, SEO_DESCRIPTION: evil, PUBLIC_URL: 'https://c.acme.example' }));
  assert.equal((html.match(/<script/g) || []).length, 1, 'seul le bloc JSON-LD est une balise <script>');
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.match(html, /<title>A&quot;&lt;script&gt;alert\(1\)&lt;\/script&gt;&amp;&#39;<\/title>/);
  assert.equal(meta(html, 'property', 'og:site_name'), 'A&quot;&lt;script&gt;alert(1)&lt;/script&gt;&amp;&#39;');
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.doesNotMatch(block, /</);
  assert.match(block, /\\u003cscript/);
  assert.equal(jsonLd(html)['@graph'][1].name, evil);
});

test('JSON-LD : WebSite et Organization, avec le contact du support s’il existe', () => {
  const html = renderHead(configOf({
    BRAND_NAME: 'Acme', PROFILE_ORGANIZATION: 'Acme SA', PUBLIC_URL: 'https://c.acme.example',
    BRAND_LOGO_URL: '/uploads/logo-0123456789abcdef.png', SUPPORT_PHONE: '+41 22 123 45 67', SUPPORT_EMAIL: 'support@acme.example',
  }));
  const ld = jsonLd(html);
  assert.equal(ld['@context'], 'https://schema.org');
  const [site, org] = ld['@graph'];
  assert.equal(site['@type'], 'WebSite');
  assert.equal(site.name, 'Acme');
  assert.equal(site.url, 'https://c.acme.example/');
  assert.equal(site.inLanguage, 'fr');
  assert.equal(org['@type'], 'Organization');
  assert.equal(org.name, 'Acme SA');
  assert.equal(org.url, 'https://c.acme.example/');
  assert.equal(org.logo, 'https://c.acme.example/uploads/logo-0123456789abcdef.png');
  assert.deepEqual(org.contactPoint, { '@type': 'ContactPoint', contactType: 'customer support', telephone: '+41 22 123 45 67', email: 'support@acme.example', availableLanguage: 'fr' });
  // Sans adresse publique ni contact : ni url, ni logo relatif, ni contactPoint.
  const bare = jsonLd(renderHead(configOf({ BRAND_LOGO_URL: '/img/logo.svg' })))['@graph'][1];
  assert.equal(bare.url, undefined);
  assert.equal(bare.logo, undefined);
  assert.equal(bare.contactPoint, undefined);
});

test('injectHead remplace le bloc balisé de index.html, et lui seul', () => {
  const src = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.match(src, /<!-- seo -->[\s\S]*<!-- \/seo -->/);
  const out = injectHead(src, '<title>X</title>');
  assert.match(out, /<title>X<\/title>/);
  assert.equal((out.match(/<title>/g) || []).length, 1);
  assert.doesNotMatch(out, /name="robots"/);
  assert.match(out, /<link rel="stylesheet" href="\/brand\.css">/);
});

/* ---------- robots.txt et sitemap.xml ---------- */

test('robots.txt : tout refusé par défaut', () => {
  assert.equal(robotsTxt(configOf({ PUBLIC_URL: 'https://c.acme.example' })), 'User-agent: *\nDisallow: /\n');
});

test('robots.txt : indexation autorisée, /support exclu, sitemap si PUBLIC_URL', () => {
  assert.equal(robotsTxt(configOf({ SEO_INDEX: 'true' })), 'User-agent: *\nAllow: /\nDisallow: /support\n');
  assert.equal(robotsTxt(configOf({ SEO_INDEX: 'true', PUBLIC_URL: 'https://c.acme.example' })),
    'User-agent: *\nAllow: /\nDisallow: /support\n\nSitemap: https://c.acme.example/sitemap.xml\n');
});

test('sitemap.xml : seulement avec l’indexation et PUBLIC_URL, page d’accueil seule', () => {
  assert.equal(sitemapXml(configOf({ PUBLIC_URL: 'https://c.acme.example' })), null);
  assert.equal(sitemapXml(configOf({ SEO_INDEX: 'true' })), null);
  const xml = sitemapXml(configOf({ SEO_INDEX: 'true', PUBLIC_URL: 'https://c.acme.example/mail' }));
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.deepEqual([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]), ['https://c.acme.example/mail/']);
  assert.doesNotMatch(xml, /#/);
});
