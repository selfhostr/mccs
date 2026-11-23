# Changelog

All notable changes to mccs. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). No version has been released yet.

## Unreleased

### Added

- Self-service setup wizard for mail (IMAP/SMTP), calendar (CalDAV) and contacts (CardDAV), with Apple profiles, autoconfig and a password-protected support page.
- Community files (security policy, contributing guide, code of conduct), a CI workflow and Dependabot configuration.
- Settings saved in `/data/config.json` (`mccs-data` volume) override the environment and apply without restart; `BRAND_BACKGROUND` for the page background; unit tests with `node --test`.
- The guide shows one step at a time, with "Step n of N", a progress bar, Previous and Next buttons, a slide transition and a screenshot column that appears only when the step has a screenshot. Each step has its own URL (`#/guide/<device>/<guide>/<n>`); the "done" checkboxes are gone.
- Admin API under `/support/api/*`: session sign-in (cookie limited to `/support`), settings, logo and background upload (`/uploads/`), TLS test of the mail servers, admin password change (scrypt hash in `/data/admin.json`). `ALLOWED_DOMAINS` setting.

### Changed

- `/support` uses a sign-in form and a session instead of HTTP Basic.
- The project is now `mccs` (Mail, Calendar, Contacts Setup) and lives at `github.com/selfhostr/mccs`.
- README and documentation follow the same layout as the other selfhostr projects.
- Inter (text) and JetBrains Mono (code, identifiers, numbers), self-hosted under `public/fonts` with their SIL OFL 1.1 licences, replace the system font stacks. No third-party request is made for fonts.
