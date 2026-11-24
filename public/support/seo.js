// Espace d'administration, section « Référencement » : prompt pour une IA générative, lecture de sa
// réponse, compteurs de longueur et troncature des aperçus. Aucun import ni accès au DOM : le module
// est testé sous Node (test/seo-ai.test.js).

// Mêmes limites que server/settings.js (max : refusé au-delà ; advice : zone conseillée).
export const LIMITS = {
  SEO_TITLE: { max: 80, advice: [30, 60] },
  SEO_DESCRIPTION: { max: 200, advice: [120, 160] },
};
const KEYS = ['SEO_TITLE', 'SEO_DESCRIPTION', 'SEO_INDEX'];
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

const chars = (s) => [...String(s || '')];

// { n, state } : state = empty | short | ok | long (au-delà du conseillé) | over (refusé).
export function lengthState(text, { max, advice: [lo, hi] }) {
  const n = chars(String(text || '').trim()).length;
  const state = n === 0 ? 'empty' : n > max ? 'over' : n < lo ? 'short' : n > hi ? 'long' : 'ok';
  return { n, state };
}

// Coupe au dernier mot entier qui tient (points de suspension compris), comme les résultats de Google.
export function truncate(text, max) {
  const c = chars(text);
  if (c.length <= max) return String(text);
  const cut = c.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  const head = space > max * 0.4 ? cut.slice(0, space) : cut;
  return head.replace(/[\s,;:.\-–—]+$/u, '') + '…';
}

/* ---------- Lecture de la réponse de l'IA ---------- */

// Premier objet { … } équilibré à partir de start (chaînes JSON et échappements pris en compte).
function balancedFrom(text, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

// Candidats, dans l'ordre : le premier bloc ``` (```json ou sans langue), sinon chaque objet { … } du texte.
function candidates(text) {
  const fence = /```[ \t]*([A-Za-z0-9_-]*)[^\n]*\n([\s\S]*?)```/g;
  for (const m of text.matchAll(fence)) {
    const lang = m[1].toLowerCase();
    const body = m[2].trim();
    if (['', 'json', 'jsonc', 'json5', 'javascript', 'js'].includes(lang) && /^[[{]/.test(body)) return [body];
  }
  const found = [];
  for (let i = text.indexOf('{'); i !== -1 && found.length < 20; i = text.indexOf('{', i + 1)) {
    const obj = balancedFrom(text, i);
    if (obj) found.push(obj);
  }
  return found;
}

function readText(key, raw, problems) {
  if (typeof raw !== 'string') { problems.push(`${key} : la valeur doit être un texte entre guillemets.`); return null; }
  const v = raw.replace(/[ \t\r\n\u2028\u2029]+/g, ' ').trim();
  if (!v) { problems.push(`${key} : valeur vide, non reprise.`); return null; }
  if (CONTROL_RE.test(v)) { problems.push(`${key} : caractère de contrôle, valeur non reprise.`); return null; }
  const n = chars(v).length;
  const { max } = LIMITS[key];
  if (n > max) { problems.push(`${key} : trop long (${n} caractères, ${max} au maximum), valeur non reprise.`); return null; }
  return v;
}

function readIndex(raw, problems) {
  if (typeof raw === 'boolean') return String(raw);
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === 'true' || v === 'false') return v;
  problems.push('SEO_INDEX : valeur attendue "true" ou "false", non reprise.');
  return null;
}

// Extrait le premier bloc JSON de la réponse collée et valide les clés connues.
// Renvoie { values: { SEO_TITLE?, SEO_DESCRIPTION?, SEO_INDEX? }, problems: [textes en français] }.
export function parseAiAnswer(text) {
  const values = {};
  const problems = [];
  const src = String(text || '');
  if (!src.trim()) return { values, problems: ['Réponse vide : collez la réponse complète de l’IA.'] };
  const list = candidates(src);
  if (!list.length) return { values, problems: ['Aucun bloc JSON trouvé dans la réponse. Demandez à l’IA de répondre avec le bloc ```json prévu.'] };
  let data;
  let error = '';
  for (const c of list) {
    try { data = JSON.parse(c); break; } catch (err) { if (!error) error = err.message; }
  }
  if (data === undefined) return { values, problems: [`JSON invalide (${error}). Vérifiez que le bloc a été copié en entier.`] };
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { values, problems: ['Le bloc JSON doit être un objet { … } avec les clés SEO_TITLE, SEO_DESCRIPTION et SEO_INDEX.'] };

  const seen = new Set();
  for (const [rawKey, raw] of Object.entries(data)) {
    const key = rawKey.trim().toUpperCase();
    if (!KEYS.includes(key)) { problems.push(`Clé inconnue ignorée : ${rawKey}.`); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    const v = key === 'SEO_INDEX' ? readIndex(raw, problems) : readText(key, raw, problems);
    if (v !== null) values[key] = v;
  }
  for (const k of KEYS) if (!seen.has(k)) problems.push(`Clé absente : ${k}.`);
  return { values, problems };
}

/* ---------- Prompt ---------- */

export const SERVICES_TEXT = 'l’e-mail (réception IMAP et envoi SMTP), le calendrier et les tâches (CalDAV), les contacts (CardDAV)';
export const DEVICES_TEXT = 'Windows (Outlook, Thunderbird), Mac (Mail, Calendrier et Contacts d’Apple, Thunderbird), iPhone et iPad (profil de configuration Apple, Outlook), Android (Gmail, Samsung Email, Outlook, DAVx⁵)';

const q = (s) => '« ' + s + ' »';

// ctx : { brand, organization, publicUrl, domains[], mailHost, webmailUrl, support: { phone, email, hours }, seo: { title, description, index } }
export function buildPrompt(ctx) {
  const c = ctx || {};
  const support = c.support || {};
  const seo = c.seo || {};
  const brand = c.brand || 'mccs';
  const org = c.organization && c.organization !== brand ? `${c.organization} (nom affiché sur la page : ${brand})` : brand;
  const domains = (c.domains || []).filter(Boolean);
  const contact = [support.phone && 'téléphone ' + support.phone, support.email && 'e-mail ' + support.email, support.hours && 'horaires : ' + support.hours].filter(Boolean);
  const { advice: [tLo, tHi], max: tMax } = LIMITS.SEO_TITLE;
  const { advice: [dLo, dHi], max: dMax } = LIMITS.SEO_DESCRIPTION;

  return [
    'Tu es une experte en référencement naturel (SEO) de pages web en français.',
    '',
    'Contexte : notre organisation publie une page web qui guide ses utilisateurs, pas à pas, pour configurer leur messagerie sur leurs appareils. C’est un outil d’aide en libre-service, pas une page commerciale. J’ai besoin du titre et de la description de cette page pour les moteurs de recherche et les aperçus de partage.',
    '',
    'Ce que je sais de la page :',
    `- Organisation : ${org}`,
    `- Adresse publique de la page : ${c.publicUrl || 'pas encore renseignée'}`,
    `- Adresses e-mail concernées : ${domains.length ? domains.map((d) => '@' + d).join(', ') + ' (domaines ' + domains.join(', ') + ')' : 'toutes les adresses (aucun domaine précis)'}`,
    `- Serveur de messagerie : ${c.mailHost || 'non précisé'}${c.webmailUrl ? ' ; webmail : ' + c.webmailUrl : ''}`,
    `- Services configurés : ${SERVICES_TEXT}`,
    `- Appareils et applications guidés : ${DEVICES_TEXT}`,
    `- Contact du support : ${contact.length ? contact.join(' ; ') : 'aucun contact affiché'}`,
    '- Valeurs actuelles :',
    `  - SEO_TITLE : ${q(seo.title || '')}`,
    `  - SEO_DESCRIPTION : ${q(seo.description || '')}`,
    `  - SEO_INDEX : "${seo.index ? 'true' : 'false'}" (${seo.index ? 'la page peut être indexée par les moteurs de recherche' : 'la page demande aux moteurs de recherche de ne pas l’indexer'})`,
    '',
    'Ce que j’attends de toi :',
    `1. S’il te manque des informations pour bien faire, pose-moi d’abord 3 à 5 questions courtes et numérotées, puis arrête-toi et attends mes réponses avant de proposer quoi que ce soit. Par exemple : le public visé (employés, clients, élèves, membres…), le type d’organisation, le ton souhaité, les mots que nos utilisateurs taperaient dans un moteur de recherche pour trouver cette page, et si la page doit être trouvable par les moteurs de recherche ou rester un outil interne. Si tu as déjà assez d’informations, passe directement à l’étape 2.`,
    '2. Ensuite, réponds avec UN SEUL bloc de code ```json contenant exactement ces trois clés, et rien d’autre dans le bloc :',
    `   - "SEO_TITLE" : le titre de la page, en français, entre ${tLo} et ${tHi} caractères (${tMax} au maximum), avec le nom de l’organisation ;`,
    `   - "SEO_DESCRIPTION" : la description affichée sous le titre dans les résultats, en français, entre ${dLo} et ${dHi} caractères (${dMax} au maximum), une ou deux phrases sur une seule ligne ;`,
    '   - "SEO_INDEX" : "true" si la page doit apparaître dans les moteurs de recherche, "false" si elle doit rester interne (une chaîne entre guillemets).',
    '3. Après le bloc, ajoute une courte explication de tes choix (trois phrases au plus), en dehors du bloc.',
    '',
    'Règles :',
    '- Aucune promesse trompeuse ni superlatif invérifiable (« le meilleur », « 100 % sécurisé », « en une minute »…).',
    '- Ne cite que les services, appareils et applications de la liste ci-dessus.',
    '- Un texte naturel qui donne envie de cliquer, sans répéter les mots-clés.',
    '- Pas d’emoji ni de retour à la ligne dans les valeurs JSON.',
  ].join('\n');
}
