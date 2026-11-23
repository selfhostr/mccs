# Configuration

The normal way to configure mccs is the admin area, `/support` (setup assistant and Settings tab): no file to edit. The environment variables below are an advanced option, for example to preset values; with Docker, add them under `environment:` in `docker-compose.yml`.

Settings come from three layers, the first one set wins:

1. **Saved settings** in `/data/config.json`, written by the admin page (no restart needed). Editing the file by hand takes effect at the next restart; to reset everything, delete it and restart.
2. **Environment variables**, read at startup. With Docker, add them under `environment:` in the compose file and run `docker compose up -d`; no rebuild needed.
3. **Built-in defaults.**

`config.json` only holds the values changed in the admin, keyed by variable name. Values derived from another one (hosts from `MAIL_HOST`, DAV URLs from `DAV_BASE_URL`, `DAV_PRESET` and the discovery URLs) keep following it until they are changed themselves. The previous version is kept in `config.prev.json`. `PORT`, `SUPPORT_USER`, `SUPPORT_PASSWORD`, `DATA_DIR` and `TRUSTED_PROXY_HEADER` can only be set in the environment.

The compose file mounts the `mccs-data` volume on `/data`. Without a writable `/data`, the app runs as before from the environment and saving is refused.

## All variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Listening port of the Node process |
| `DATA_DIR` | `/data` | Folder for saved settings (`config.json`), the admin password (`admin.json`) and uploads |
| `TRUSTED_PROXY_HEADER` | empty | Header giving the client IP behind a trusted proxy: `CF-Connecting-IP` or `X-Forwarded-For`; empty = connection address. Environment only |
| `BRAND_NAME` | `mccs` | Name shown in the UI. This is the fallback shown to your users: set your own |
| `BRAND_LOGO_URL` | empty | `/img/...` path or absolute https URL; empty = text name + neutral icon |
| `BRAND_ACCENT` | ink blue (#8cbfe6 dark, #1f5f8b light) | Accent colour, `#rgb` or `#rrggbb` |
| `BRAND_BACKGROUND` | empty | Page background: `#rrggbb`, a gradient `#rrggbb,#rrggbb`, or an image uploaded from the admin (`/uploads/<file>`) |
| `MAIL_HOST` | `mail.example.com` | Default for IMAP, SMTP, webmail and DAV hosts |
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_SECURITY` | `MAIL_HOST` / `993` / `SSL/TLS` | Incoming server |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURITY` | `MAIL_HOST` / `465` / `SSL/TLS` | Outgoing server |
| `WEBMAIL_URL` | `https://MAIL_HOST/` | Webmail link |
| `ALLOWED_DOMAINS` | empty | Email domains accepted by the connection test, comma-separated (`example.com, example.org`); empty = all |
| `CONNECTION_TEST` | `false` | Let customers check their password before setup (`POST /api/test`). Also accepts `1`, `on`, `yes` in the environment; the admin saves `true` or `false` |
| `CONNECTION_TEST_MAX_PER_EMAIL` | `5` | Checks allowed per email address in 15 minutes (1 to 10000) |
| `CONNECTION_TEST_MAX_PER_IP` | `20` | Checks allowed per client IP in 15 minutes, all addresses together (1 to 10000) |
| `TEST_MSG_IMAP_<STATUS>`, `TEST_MSG_SMTP_<STATUS>`, `TEST_MSG_RATE_LIMITED`, `TEST_MSG_DOMAIN` | French texts | Message shown to the customer for each result of the check, see below |
| `DAV_PRESET` | `mdaemon` | Server type, `mdaemon` or `generic`. Set by the admin's automatic detection; still accepted in the environment |
| `DAV_BASE_URL` | `https://MAIL_HOST` | Base of all DAV URLs |
| `CALDAV_URL`, `CARDDAV_URL`, `TASKS_URL` | per server type | Generic server URLs shown before an address is typed |
| `DAV_DISCOVERY_URL`, `DAV_CARD_DISCOVERY_URL` | `DAV_BASE_URL/.well-known/caldav` and `/carddav` | Calendar and contacts discovery URLs, filled by the automatic detection. With `generic`, every calendar and contacts URL follows them |
| `DAV_PRINCIPAL_URL_TEMPLATE`, `DAV_CALENDAR_URL_TEMPLATE`, `DAV_TASKS_URL_TEMPLATE`, `DAV_CONTACTS_URL_TEMPLATE` | per server type | Personal URL templates (`{email}`, `{local}`, `{domain}`) |
| `PUBLIC_URL` | empty | Public address of this app (links, QR codes); empty = the address used by the browser |
| `SUPPORT_PHONE`, `SUPPORT_EMAIL`, `SUPPORT_HOURS`, `SUPPORT_ADDRESS` | empty | Support contact; each hidden when empty |
| `SUPPORT_USER` | `support` | Admin user for `/support` |
| `SUPPORT_PASSWORD` | empty | Optional admin password. Empty = one is generated on first start and printed in the logs; once changed in the admin, `/data/admin.json` wins |
| `PROFILE_ORGANIZATION` | `BRAND_NAME` | Organisation in the Apple profile |
| `PROFILE_ID_PREFIX` | `com.example.mailsetup` | Profile identifier prefix: set your own reverse-domain prefix |
| `CALDAVSYNC_URL`, `DAVX5_GITHUB_URL`, `DAVX5_FDROID_URL`, `DAVX5_PLAY_URL`, `THUNDERBIRD_URL` | official download pages | Download links used in guides |

## Docker

The compose file holds only the image, the port, the volume and the hardening. Change the published port by editing the `ports` line (`"8443:8080"`). Inside the container the app listens on `PORT` (8080).

## Branding

- `BRAND_NAME`: name in the UI and default for `PROFILE_ORGANIZATION`.
- `BRAND_ACCENT`: `#rgb` or `#rrggbb`, served through the generated `/brand.css`. It is the colour of buttons and main surfaces with white text on top, so choose one that keeps a contrast of at least 4.5:1 with white.
- `BRAND_LOGO_URL`: a local path such as `/img/logo.svg` (file baked into the image or mounted under `public/img`), or an absolute https URL. For a remote URL its origin is added to the CSP `img-src` automatically. Empty gives the text name and a neutral icon.
- `SUPPORT_PHONE`, `SUPPORT_EMAIL`, `SUPPORT_HOURS`, `SUPPORT_ADDRESS`: shown to users, each hidden when empty.
- `SUPPORT_PHONE` accepts the usual formats of any country, written as your customers dial it: an optional leading `+` with the country code, digits, spaces (non-breaking ones too), `( ) . / -`, and an optional extension at the end (`ext. 12`, `x 12`, `poste 12`, `#12`). For example `+33 1 23 45 67 89`, `(022) 123 45 67`, `+1 (555) 010-0100`, `0800 123 456` or `+44 20 7946 0958 ext. 12`. Letters (other than the extension marker) and control characters are refused. The call link is built as `tel:+442079460958;ext=12` (RFC 3966).

## Servers

`MAIL_HOST` (default `mail.example.com`) is the default for `IMAP_HOST`, `SMTP_HOST`, `WEBMAIL_URL` (`https://MAIL_HOST/`) and `DAV_BASE_URL` (`https://MAIL_HOST`).
Ports and security labels: `IMAP_PORT` 993, `IMAP_SECURITY` `SSL/TLS`, `SMTP_PORT` 465, `SMTP_SECURITY` `SSL/TLS`.

`ALLOWED_DOMAINS` lists the email domains for which the customer connection test is allowed, separated by commas, for example `example.com, example.org`. Case and spaces do not matter. Empty accepts every domain.

## Password check

`CONNECTION_TEST` (off by default) adds a password field to the home page: mccs logs in to your IMAP server, then, if that worked, to your SMTP server, and tells the customer what works. Nothing is stored. Turn it on in the setup assistant (step "Serveurs mail") or in Settings > "Vérification du mot de passe". **Before turning it on, whitelist the mccs IP address in your mail server's brute-force protection**: see [Security](security.md#whitelist-mccs-on-your-mail-server).

`CONNECTION_TEST_MAX_PER_EMAIL` (5) and `CONNECTION_TEST_MAX_PER_IP` (20) limit the checks per address and per client IP over 15 minutes. They are settings rather than constants because the right values depend on your mail server's own lock threshold and on how many customers share one IP (an office behind one NAT). Keep the per-address limit below your server's lock threshold. Behind a proxy, set `TRUSTED_PROXY_HEADER`, otherwise every customer shares the proxy's address and the per-IP limit applies to all of them together.

### Help messages

Each result has an editable message (Settings > "Messages d'aide"), one per status and per service: `TEST_MSG_IMAP_OK`, `TEST_MSG_IMAP_AUTH_FAILED`, `TEST_MSG_IMAP_BLOCKED`, `TEST_MSG_IMAP_UNREACHABLE`, `TEST_MSG_IMAP_TLS_ERROR`, `TEST_MSG_IMAP_TIMEOUT`, `TEST_MSG_IMAP_ERROR`, the same for `TEST_MSG_SMTP_*` plus `TEST_MSG_SMTP_SKIPPED` (SMTP not tried because IMAP failed), and `TEST_MSG_RATE_LIMITED` and `TEST_MSG_DOMAIN`. Plain text, 500 characters at most; a line break starts a new paragraph; HTML is shown as text. Empty = the built-in French text. They are public (served in `/api/config`).

The FAQ of the Help panel is not editable yet: its answers embed live values (server names, ports, webmail link) and formatting, which needs its own editor.

## Calendar and contacts

### Automatic detection

You normally set nothing here. In the admin (setup assistant, step "Calendrier", and Settings > "Calendrier et contacts"), mccs looks for the calendar and contacts services of your server, as clients do (RFC 6764), without credentials:

1. DNS `SRV` records `_caldavs._tcp` and `_carddavs._tcp` (and their `TXT` `path=`), first on the domain (`example.com` for `mail.example.com`), then on the host itself;
2. `https://<host>/.well-known/caldav` and `/.well-known/carddav`, following up to 5 redirections (https only).

The host is the one of `DAV_BASE_URL`, which defaults to `https://MAIL_HOST`. An address is kept only when a DAV service really answers there: a `207 Multi-Status` reply to `PROPFIND`, a `DAV` header announcing `calendar-access` or `addressbook` (on `PROPFIND` or `OPTIONS`), or a `401` asking for credentials at an address given by DNS or reached through a `.well-known` redirection. Without credentials mccs cannot know each customer's personal URL, so it keeps the context URL (after redirections); DAVx⁵, iPhone/iPad/Mac, Thunderbird and CalDAV Synchronizer find the customer's calendars and address books from there.

The detection runs by itself when you reach the "Calendrier" step with `MAIL_HOST` filled in, and on demand with "Détecter automatiquement". What it finds fills these settings, which you can still edit under "Avancé":

- an MDaemon server (recognised by its `Server` or `WWW-Authenticate` header, or by its `/webdav/` paths) sets `DAV_PRESET=mdaemon`: the personal URLs follow the MDaemon layout (see [MDaemon](mdaemon.md)) and only the host is taken from the result (`DAV_BASE_URL`, when it differs);
- any other server sets `DAV_PRESET=generic`, `DAV_DISCOVERY_URL` (calendar) and `DAV_CARD_DISCOVERY_URL` (contacts). With `generic`, every calendar, tasks and contacts URL shown to customers is one of these two addresses.

When nothing is found, type the two addresses under "Avancé". The server type then follows what you type: an address with `/webdav/` means MDaemon, anything else `generic`.

### Manual setting

`DAV_PRESET` stays accepted in the environment and still defaults to `mdaemon`, so an existing installation gives exactly the same URLs as before. With `generic` and no discovery URL set, every DAV URL is `DAV_BASE_URL/.well-known/caldav` or `/carddav`, as before. Any URL can be overridden individually:

- `CALDAV_URL`, `CARDDAV_URL`, `TASKS_URL`: generic URLs shown before an address is typed.
- `DAV_DISCOVERY_URL`, `DAV_CARD_DISCOVERY_URL`: discovery URLs; with `generic`, they are also the default for every other URL below.
- `DAV_PRINCIPAL_URL_TEMPLATE`, `DAV_CALENDAR_URL_TEMPLATE`, `DAV_TASKS_URL_TEMPLATE`, `DAV_CONTACTS_URL_TEMPLATE`: personal URLs. Placeholders `{email}`, `{local}` (before the `@`) and `{domain}`, lower-cased. They are applied both in the browser and in the Apple profile.

## App, support and profile

- `PUBLIC_URL`: public address used in links and QR codes. Empty = the address used by the browser; set it when mccs sits behind a proxy under another name.
- `SUPPORT_USER` (`support`) and `SUPPORT_PASSWORD`: sign-in for `/support`. The password can then be changed in the admin; it is stored hashed in `/data/admin.json`, and deleting that file generates a new password at the next start (or brings `SUPPORT_PASSWORD` back if set). Without `SUPPORT_PASSWORD`, a password is generated on first start and printed in the logs. Only a non-writable `/data` without `SUPPORT_PASSWORD` disables the page (404).
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

## Example: other servers (Nextcloud, SOGo, Radicale, Baïkal, Stalwart...)

Easiest: let the admin detect the addresses. As environment variables only, the equivalent is:

```env
MAIL_HOST=mail.example.com
PUBLIC_URL=https://config.example.com
DAV_PRESET=generic
# What the detection would find for a Nextcloud on another host
DAV_DISCOVERY_URL=https://cloud.example.com/remote.php/dav/
DAV_CARD_DISCOVERY_URL=https://cloud.example.com/remote.php/dav/
# Optional: per-customer URLs instead of the discovery URLs
DAV_CALENDAR_URL_TEMPLATE=https://cloud.example.com/remote.php/dav/calendars/{email}/personal/
DAV_CONTACTS_URL_TEMPLATE=https://cloud.example.com/remote.php/dav/addressbooks/users/{email}/contacts/
```

For SOGo, a template such as `https://mail.example.com/SOGo/dav/{email}/Calendar/personal/` works the same way.
