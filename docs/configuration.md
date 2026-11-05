# Configuration

All settings are environment variables, read at startup. Empty or unset means the built-in default. With Docker, put them in `.env` (see `.env.example`) and run `docker compose up -d`; no rebuild needed.

## All variables

| Variable | Default | Description |
|---|---|---|
| `HOST_PORT` | `8080` | Published host port (compose only) |
| `IMAGE_NAME` | `mccs` | Docker image name (compose only) |
| `CONTAINER_NAME` | `mccs` | Container name (compose only) |
| `PORT` | `8080` | Listening port of the Node process |
| `BRAND_NAME` | `Mail Setup` | Name shown in the UI. This is the fallback shown to your users: set your own |
| `BRAND_LOGO_URL` | empty | `/img/...` path or absolute https URL; empty = text name + neutral icon |
| `BRAND_ACCENT` | `#2563eb` | Accent colour, `#rgb` or `#rrggbb` |
| `MAIL_HOST` | `mail.example.com` | Default for IMAP, SMTP, webmail and DAV hosts |
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_SECURITY` | `MAIL_HOST` / `993` / `SSL/TLS` | Incoming server |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURITY` | `MAIL_HOST` / `465` / `SSL/TLS` | Outgoing server |
| `WEBMAIL_URL` | `https://MAIL_HOST/` | Webmail link |
| `DAV_PRESET` | `mdaemon` | `mdaemon` or `generic` |
| `DAV_BASE_URL` | `https://MAIL_HOST` | Base of all DAV URLs |
| `CALDAV_URL`, `CARDDAV_URL`, `TASKS_URL` | per preset | Generic server URLs shown before an address is typed |
| `DAV_DISCOVERY_URL`, `DAV_CARD_DISCOVERY_URL` | `DAV_BASE_URL/.well-known/caldav` and `/carddav` | Discovery URLs (DAVx5, CalDAV Synchronizer) |
| `DAV_PRINCIPAL_URL_TEMPLATE`, `DAV_CALENDAR_URL_TEMPLATE`, `DAV_TASKS_URL_TEMPLATE`, `DAV_CONTACTS_URL_TEMPLATE` | per preset | Personal URL templates (`{email}`, `{local}`, `{domain}`) |
| `PUBLIC_URL` | `https://config.example.com` | Public address of this app (links, QR codes) |
| `SUPPORT_PHONE`, `SUPPORT_EMAIL`, `SUPPORT_HOURS`, `SUPPORT_ADDRESS` | empty | Support contact; each hidden when empty |
| `SUPPORT_USER` | `support` | Basic auth user for `/support` |
| `SUPPORT_PASSWORD` | empty | Basic auth password; empty = `/support` returns 404 |
| `PROFILE_ORGANIZATION` | `BRAND_NAME` | Organisation in the Apple profile |
| `PROFILE_ID_PREFIX` | `com.example.mailsetup` | Profile identifier prefix: set your own reverse-domain prefix |
| `CALDAVSYNC_URL`, `DAVX5_GITHUB_URL`, `DAVX5_FDROID_URL`, `DAVX5_PLAY_URL`, `THUNDERBIRD_URL` | official download pages | Download links used in guides |

## Docker

`HOST_PORT` (8080), `IMAGE_NAME` and `CONTAINER_NAME` (both `mccs`). Inside the container the app listens on `PORT` (8080).

## Branding

- `BRAND_NAME`: name in the UI and default for `PROFILE_ORGANIZATION`.
- `BRAND_ACCENT`: `#rgb` or `#rrggbb`, served through the generated `/brand.css`.
- `BRAND_LOGO_URL`: a local path such as `/img/logo.svg` (file baked into the image or mounted under `public/img`), or an absolute https URL. For a remote URL its origin is added to the CSP `img-src` automatically. Empty gives the text name and a neutral icon.
- `SUPPORT_PHONE`, `SUPPORT_EMAIL`, `SUPPORT_HOURS`, `SUPPORT_ADDRESS`: shown to users, each hidden when empty.

## Servers

`MAIL_HOST` (default `mail.example.com`) is the default for `IMAP_HOST`, `SMTP_HOST`, `WEBMAIL_URL` (`https://MAIL_HOST/`) and `DAV_BASE_URL` (`https://MAIL_HOST`).
Ports and security labels: `IMAP_PORT` 993, `IMAP_SECURITY` `SSL/TLS`, `SMTP_PORT` 465, `SMTP_SECURITY` `SSL/TLS`.

## Calendar and contacts

`DAV_PRESET` is `mdaemon` (default) or `generic` (every DAV URL falls back to `.well-known` discovery). Any URL can be overridden individually:

- `CALDAV_URL`, `CARDDAV_URL`, `TASKS_URL`: generic URLs shown before an address is typed.
- `DAV_DISCOVERY_URL`, `DAV_CARD_DISCOVERY_URL`: discovery URLs.
- `DAV_PRINCIPAL_URL_TEMPLATE`, `DAV_CALENDAR_URL_TEMPLATE`, `DAV_TASKS_URL_TEMPLATE`, `DAV_CONTACTS_URL_TEMPLATE`: personal URLs. Placeholders `{email}`, `{local}` (before the `@`) and `{domain}`, lower-cased. They are applied both in the browser and in the Apple profile.

## App, support and profile

- `PUBLIC_URL`: public address used in links and QR codes.
- `SUPPORT_USER` (`support`) and `SUPPORT_PASSWORD`: Basic auth for `/support`. Empty password disables the page (404). Generate one with `openssl rand -base64 24`.
- `PROFILE_ORGANIZATION` (defaults to `BRAND_NAME`) and `PROFILE_ID_PREFIX` (`com.example.mailsetup`).
- Download links: `CALDAVSYNC_URL`, `DAVX5_GITHUB_URL`, `DAVX5_FDROID_URL`, `DAVX5_PLAY_URL`, `THUNDERBIRD_URL`.

## Example: MDaemon

```env
BRAND_NAME=Example Mail
BRAND_ACCENT=#0f766e
MAIL_HOST=mail.example.com
PUBLIC_URL=https://config.example.com
DAV_PRESET=mdaemon
SUPPORT_EMAIL=support@example.com
```

## Example: generic server (Dovecot + SOGo, Nextcloud...)

```env
MAIL_HOST=mail.example.com
PUBLIC_URL=https://config.example.com
DAV_PRESET=generic
# Nextcloud-style explicit URLs
DAV_BASE_URL=https://cloud.example.com
CALDAV_URL=https://cloud.example.com/remote.php/dav
CARDDAV_URL=https://cloud.example.com/remote.php/dav
DAV_CALENDAR_URL_TEMPLATE=https://cloud.example.com/remote.php/dav/calendars/{email}/personal/
DAV_CONTACTS_URL_TEMPLATE=https://cloud.example.com/remote.php/dav/addressbooks/users/{email}/contacts/
```

For SOGo, a template such as `https://mail.example.com/SOGo/dav/{email}/Calendar/personal/` works the same way.
