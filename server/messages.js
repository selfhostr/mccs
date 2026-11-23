'use strict';

// Messages montrés au client après le test de connexion (POST /api/test), un par statut et par service.
// Valeurs par défaut ; chacune se remplace dans l'admin (réglage TEST_MSG_<SERVICE>_<STATUT>).

const STATUSES = ['ok', 'auth_failed', 'blocked', 'unreachable', 'tls_error', 'timeout', 'error'];
// L'envoi n'est testé qu'après une réception réussie : il peut donc être « sauté ».
const SMTP_STATUSES = [...STATUSES, 'skipped'];

const LABELS = {
  ok: 'Tout fonctionne',
  auth_failed: 'Identifiants refusés',
  blocked: 'Compte ou accès bloqué',
  unreachable: 'Serveur injoignable',
  tls_error: 'Connexion sécurisée impossible',
  timeout: 'Pas de réponse',
  error: 'Autre erreur',
  skipped: 'Non vérifié (réception en échec)',
};

const DEFAULTS = {
  imap: {
    ok: 'Votre adresse et votre mot de passe sont corrects : la réception de vos e-mails fonctionne.',
    auth_failed: 'Le serveur a refusé l’adresse ou le mot de passe. Vérifiez les majuscules, les chiffres et les espaces, puis réessayez. Essayez aussi de vous connecter au webmail : s’il refuse le mot de passe lui aussi, contactez le support pour le réinitialiser.',
    blocked: 'Votre compte est bloqué pour le moment, souvent après plusieurs mots de passe erronés. Patientez une quinzaine de minutes avant de réessayer, ou contactez le support.',
    unreachable: 'Le serveur de réception ne répond pas pour le moment. Ce n’est pas lié à votre mot de passe : réessayez dans quelques minutes, ou contactez le support si le problème continue.',
    tls_error: 'La connexion sécurisée au serveur de réception n’a pas pu être établie. Ce n’est pas lié à votre mot de passe : contactez le support.',
    timeout: 'Le serveur de réception a mis trop de temps à répondre. Réessayez dans quelques minutes.',
    error: 'La vérification de la réception n’a pas pu aboutir. Réessayez, ou continuez sans vérifier.',
  },
  smtp: {
    ok: 'L’envoi de vos e-mails fonctionne avec les mêmes identifiants.',
    auth_failed: 'La réception fonctionne, mais le serveur d’envoi refuse vos identifiants. Contactez le support : votre compte n’a peut-être pas encore le droit d’envoyer.',
    blocked: 'L’envoi est bloqué pour votre compte pour le moment. Contactez le support.',
    unreachable: 'Le serveur d’envoi ne répond pas pour le moment. La réception fonctionne : vous pouvez continuer et réessayer plus tard.',
    tls_error: 'La connexion sécurisée au serveur d’envoi n’a pas pu être établie. La réception fonctionne : vous pouvez continuer, et prévenir le support.',
    timeout: 'Le serveur d’envoi a mis trop de temps à répondre. La réception fonctionne : vous pouvez continuer et réessayer plus tard.',
    error: 'La vérification de l’envoi n’a pas pu aboutir. La réception fonctionne : vous pouvez continuer.',
    skipped: 'L’envoi sera vérifié une fois la réception réussie.',
  },
  rate_limited: 'Trop de vérifications en peu de temps. Patientez quelques minutes avant de réessayer, ou continuez sans vérifier.',
  domain: 'Cette adresse ne fait pas partie des domaines gérés ici. Vérifiez qu’elle ne contient pas de faute de frappe, ou continuez sans vérifier.',
};

const keyOf = (service, status) => `TEST_MSG_${service.toUpperCase()}_${status.toUpperCase()}`;

// Champs de réglage (server/settings.js), dans l'ordre d'affichage : par statut, réception puis envoi.
function messageFields() {
  const out = [];
  for (const status of SMTP_STATUSES) {
    for (const service of ['imap', 'smtp']) {
      if (service === 'imap' && status === 'skipped') continue;
      out.push({
        key: keyOf(service, status), group: 'messages', type: 'message', status, service,
        label: `${service === 'imap' ? 'Réception' : 'Envoi'} : ${LABELS[status].toLowerCase()}`,
      });
    }
  }
  out.push({ key: 'TEST_MSG_RATE_LIMITED', group: 'messages', type: 'message', status: 'rate_limited', label: 'Trop de vérifications' });
  out.push({ key: 'TEST_MSG_DOMAIN', group: 'messages', type: 'message', status: 'domain', label: 'Domaine non accepté' });
  return out;
}

// Messages effectifs à partir d'une fonction env(clé, défaut).
function buildMessages(env) {
  const pick = (service, statuses) => Object.fromEntries(statuses.map((s) => [s, env(keyOf(service, s), DEFAULTS[service][s])]));
  return {
    imap: pick('imap', STATUSES),
    smtp: pick('smtp', SMTP_STATUSES),
    rate_limited: env('TEST_MSG_RATE_LIMITED', DEFAULTS.rate_limited),
    domain: env('TEST_MSG_DOMAIN', DEFAULTS.domain),
  };
}

// Valeur effective d'un réglage de message (affichée dans l'admin).
function effectiveMessage(messages, field) {
  if (field.service) return messages[field.service][field.status];
  return messages[field.status];
}

module.exports = { STATUSES, SMTP_STATUSES, LABELS, DEFAULTS, messageFields, buildMessages, effectiveMessage };
