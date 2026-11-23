# Changelog

All notable changes to mccs. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). No version has been released yet.

## Unreleased

### Added

- Outlook mobile guide for iPhone, iPad and Android (mail).
- Self-service setup wizard for mail (IMAP/SMTP), calendar (CalDAV) and contacts (CardDAV), with Apple profiles, autoconfig and a password-protected support page.
- Community files (security policy, contributing guide, code of conduct), a CI workflow and Dependabot configuration.
- Settings saved in `/data/config.json` (`mccs-data` volume) override the environment and apply without restart; `BRAND_BACKGROUND` for the page background; unit tests with `node --test`.
- The guide shows one step at a time, with "Step n of N", a progress bar, Previous and Next buttons, a slide transition and a screenshot column that appears only when the step has a screenshot. Each step has its own URL (`#/guide/<device>/<guide>/<n>`); the "done" checkboxes are gone.
- Admin API under `/support/api/*`: session sign-in (cookie limited to `/support`), settings, logo and background upload (`/uploads/`), TLS test of the mail servers, admin password change (scrypt hash in `/data/admin.json`). `ALLOWED_DOMAINS` setting.

- Automatic detection of the calendar (CalDAV) and contacts (CardDAV) addresses in the admin, as clients do (RFC 6764: DNS `SRV`/`TXT`, then `/.well-known` with redirections), with MDaemon recognised. It runs by itself at the "Calendrier" step of the setup assistant and on demand ("Détecter automatiquement") in Settings. New route `POST /support/api/discover`.

### Changed

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
