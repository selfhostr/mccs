# Changelog

All notable changes to mccs. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- Search engines and link previews (Settings > "Référencement"): `SEO_INDEX` (off by default, the page stays `noindex`), `SEO_TITLE`, `SEO_DESCRIPTION` and `SEO_IMAGE` (uploaded, falls back to a PNG, JPEG or WebP brand logo). The server renders the head of the home page from them (title, description, `robots`, canonical URL, Open Graph, Twitter card, JSON-LD `WebSite` and `Organization` with the support contact) and serves `/robots.txt` and, when indexing is on and `PUBLIC_URL` is set, `/sitemap.xml`. `/support` stays `noindex`.
- The admin shows a live Google result preview and link preview with character counters, and can copy a prompt for a generative AI built from the current settings, then fill the fields from the JSON block of its answer (nothing is saved until "Enregistrer").

## [1.0.1] - 2026-11-24

### Fixed

- A host folder mounted on `/data` (for example `./mccs:/data`, created by Docker as root) left the admin area disabled (404) and the settings read-only, without a word. The container now starts as root only to give `/data` to the app user (uid 1000), then drops root before loading the server (`user: "0:0"` and `cap_add: [CHOWN, SETUID, SETGID, DAC_READ_SEARCH]` in `docker-compose.yml`). Older compose files keep working as before.
- When `/data` is not writable, the logs say so and give the `chown` command to run.
- The first sign-in message no longer gives the container port (8080) as the address: it points to the published port.

## [1.0.0] - 2026-11-23

### Added

- Prebuilt image `ghcr.io/selfhostr/mccs` (amd64, arm64), published by the release workflow: `vX.Y.Z` tags give `:X.Y.Z`, `:X.Y`, `:X` and `:latest`, `main` gives `:edge`.
- `docker-compose.build.yml` to build from a checkout.
- First start without `SUPPORT_PASSWORD` generates an admin password, printed in the logs (user `support`, address of `/support`) until the admin changes it; a banner invites the admin to change it.
- Outlook mobile guide for iPhone, iPad and Android (mail).
- Self-service setup wizard for mail (IMAP/SMTP), calendar (CalDAV) and contacts (CardDAV), with Apple profiles, autoconfig and a password-protected support page.
- Community files (security policy, contributing guide, code of conduct), a CI workflow and Dependabot configuration.
- Settings saved in `/data/config.json` (`mccs-data` volume) override the environment and apply without restart; `BRAND_BACKGROUND` for the page background; unit tests with `node --test`.
- The guide shows one step at a time, with "Step n of N", a progress bar, Previous and Next buttons, a slide transition and a screenshot column that appears only when the step has a screenshot. Each step has its own URL (`#/guide/<device>/<guide>/<n>`); the "done" checkboxes are gone.
- Admin API under `/support/api/*`: session sign-in (cookie limited to `/support`), settings, logo and background upload (`/uploads/`), TLS test of the mail servers, admin password change (scrypt hash in `/data/admin.json`). `ALLOWED_DOMAINS` setting.
- Optional password check (`CONNECTION_TEST`, off by default): the home page asks for the mailbox password and `POST /api/test` logs in to the configured IMAP server, then SMTP (`AUTH PLAIN` or `LOGIN`, no message sent), and shows one line per service with an editable help message per result (`TEST_MSG_*`, Settings > "Messages d'aide"). Limits per address (`CONNECTION_TEST_MAX_PER_EMAIL`, 5) and per IP (`CONNECTION_TEST_MAX_PER_IP`, 20) over 15 minutes, `ALLOWED_DOMAINS` enforced, password never stored, logged or returned. The admin switch sits in the assistant's "Serveurs mail" step and in Settings; the "whitelist mccs on your mail server" notice (with MDaemon Dynamic Screening when MDaemon is recognised) now shows only when the check is on.
- Automatic detection of the calendar (CalDAV) and contacts (CardDAV) addresses in the admin, as clients do (RFC 6764: DNS `SRV`/`TXT`, then `/.well-known` with redirections), with MDaemon recognised. It runs by itself at the "Calendrier" step of the setup assistant and on demand ("Détecter automatiquement") in Settings. New route `POST /support/api/discover`.

### Changed

- Install is now `curl -O` of `docker-compose.yml`, `docker compose up -d` and `docker compose logs mccs`. The compose file no longer reads variables and `.env.example` is gone; everything is set from `/support`. Environment variables are still read, as an advanced option under `environment:`.
- `HOST_PORT`, `IMAGE_NAME` and `CONTAINER_NAME` are removed; change the port in the `ports` line.
- `PUBLIC_URL` is empty by default and follows the address used by the browser (it was `https://config.example.com`).
- `/support` is always active; it answers 404 only when `/data` is not writable and `SUPPORT_PASSWORD` is not set.
- Upgrade with `docker compose pull && docker compose up -d`.
- Real brand logos (Windows, macOS, iPhone/iPad, Android, Outlook, Thunderbird, Gmail, Samsung, Apple) for devices and apps, replacing generic pictograms (Simple Icons, CC0; Windows and Outlook drawn for the project; see `public/img/brands/README.md`).
- Pages no longer scroll when their content fits the screen (flex body instead of a fixed `calc()` height).
- Slimmer one-line footer with support phone and e-mail icons, stacked and centred on mobile.
- `/support` uses a sign-in form and a session instead of HTTP Basic.
- The project is now `mccs` (Mail, Calendar, Contacts Setup) and lives at `github.com/selfhostr/mccs`.
- README and documentation follow the same layout as the other selfhostr projects.
- Usable outside Switzerland: `SUPPORT_PHONE` accepts the usual formats of any country (country code, parentheses, dots, dashes, an extension such as `ext. 12`) and refuses letters and control characters, with the same rule in the browser and on the server; the call link carries the extension (`tel:…;ext=12`). Pages are marked `lang="fr"` instead of `fr-CH`, and examples are neutral (`example.com`, `+1 555 010 0100`, `com.example.mail`).
- The "Type de serveur" list (MDaemon / other) is gone from the admin: `DAV_PRESET` is now set by the detection (still accepted in `.env`, default unchanged). With `DAV_PRESET=generic`, the calendar, tasks and contacts URLs follow `DAV_DISCOVERY_URL` and `DAV_CARD_DISCOVERY_URL` (unchanged when those are not set).
- The "Liens clients" tab no longer prepares an email or SMS (buttons, mobile number field and message texts removed): it gives the link to copy and the QR code (PNG or SVG) only.
- Inter (text) and JetBrains Mono (code, identifiers, numbers), self-hosted under `public/fonts` with their SIL OFL 1.1 licences, replace the system font stacks. No third-party request is made for fonts.

[1.0.1]: https://github.com/selfhostr/mccs/releases/tag/v1.0.1
[1.0.0]: https://github.com/selfhostr/mccs/releases/tag/v1.0.0
