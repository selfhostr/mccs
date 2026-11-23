# Endpoints

Only `GET` and `HEAD` are accepted, except `POST` and `PUT` on `/support/api/*` and `POST` on `/api/test`; anything else gets 405.

| Path | Purpose |
|---|---|
| `/` | Wizard. Query params: `email`, `name`, `device` (`windows`, `macos`, `ios`, `android`), `app` (guide id, e.g. `ios-profile`, `outlook-classic`, `caldavsync`, `davx5`) |
| `/support` | Admin area (session sign-in): setup assistant, settings, customer links. Without a session, `/support/` redirects (302) to `/support/login.html`. 404 while no admin password exists |
| `/uploads/<kind>-<16 hex>.<png\|jpg\|webp>` | Logo or background uploaded from the admin, served from `/data/uploads`, cached for a year |
| `/profile.mobileconfig?email=&name=&services=mail,calendar,contacts` | Unsigned Apple profile, no password; 400 on invalid email |
| `/mail/config-v1.1.xml?emailaddress=` | Thunderbird autoconfig (also at `/.well-known/autoconfig/mail/`) |
| `/api/config` | Public settings, read by the browser; nothing secret. Includes `connectionTest` (boolean) and `testMessages` (`{ imap: { status: text }, smtp: {...}, rate_limited, domain }`) |
| `POST /api/test` | Password check, see below. 404 while `CONNECTION_TEST` is off |
| `/brand.css` | Generated accent colour and page background, `no-cache` |
| `/healthz` | Health check, answers `ok` |

## Password check: `POST /api/test`

Only when `CONNECTION_TEST` is on (404 otherwise). Body `{ "email": "...", "password": "..." }`, `Content-Type: application/json`, 8 KB at most; `Origin` must name this server or `PUBLIC_URL`. Answers are JSON with `Cache-Control: no-store`. Any other field (a host, a port) is ignored: only the configured servers are contacted.

| Status | Body | When |
|---|---|---|
| 200 | `{ "imap": { "status" }, "smtp": { "status" } }` | The check ran. `status` is `ok`, `auth_failed`, `blocked`, `unreachable`, `tls_error`, `timeout` or `error`; SMTP is `skipped` when IMAP was not `ok` |
| 400 | `{ "error": "json" }` | Body is not a JSON object |
| 403 | `{ "error": "origin" }` or `{ "error": "domain" }` | Foreign or missing `Origin`; address outside `ALLOWED_DOMAINS` |
| 405 | `{ "error": "method" }`, `Allow: POST` | Not a POST |
| 413 | `{ "error": "size" }` | Body over 8 KB |
| 415 | `{ "error": "type" }` | Not `application/json` |
| 422 | `{ "error": "email" }` or `{ "error": "password" }` | Invalid address; password missing, longer than 1024 characters, or containing NUL, CR or LF |
| 429 | `{ "error": "rate_limited", "retryAfter" }` (seconds), `Retry-After` | Over `CONNECTION_TEST_MAX_PER_EMAIL` for this address or `CONNECTION_TEST_MAX_PER_IP` for this client IP in 15 minutes |
| 503 | `{ "error": "busy" }` | 50 checks already running |

## Admin API

All answers are JSON with `Cache-Control: no-store`. `POST` and `PUT` need an `Origin` header naming this server, otherwise 403 `{ "error": "origin" }`. Bodies are limited to 64 KB (2 MB for uploads). Without a valid session, every route except `login` answers 401 `{ "error": "session" }`.

| Method and path | Body | Answer |
|---|---|---|
| `POST /support/api/login` | `{ user, password }` | 200 `{ ok: true }` and the `mccs_admin` cookie; 401 `{ error: "credentials" }`; 429 `{ error: "locked", retryAfter }` (seconds) after 10 failures in 15 minutes from one address |
| `POST /support/api/logout` | none | 200 `{ ok: true }`, cookie cleared |
| `GET /support/api/state` | | `{ brand, writable, setupDone, fields, passwordFromEnv }` |
| `PUT /support/api/settings` | `{ values: { KEY: "value" } }` (`""` = back to default) | 200 `{ ok: true, fields }` or 422 `{ ok: false, errors }` |
| `POST /support/api/settings/restore` | none | 200 `{ ok: true, fields }` or 409 `{ ok: false }` |
| `POST /support/api/setup-done` | none | 200 `{ ok: true }` |
| `POST /support/api/upload?kind=logo\|background` | raw image, `Content-Type: image/png`, `image/jpeg` or `image/webp` | 200 `{ ok: true, path: "/uploads/..." }`; 415 wrong type or magic bytes; 413 over 2 MB |
| `POST /support/api/probe` | `{ host, port, security: "SSL/TLS" \| "STARTTLS" }` | 200 `{ ok: true, greeting, tls: { authorized, subject } }` or `{ ok: false, error: "unreachable" \| "timeout" \| "tls" \| "protocol", detail }` (8 s timeout); 422 on an invalid host, port or security |
| `POST /support/api/discover` | `{ host }`: a host name or an `http(s)://` address (its host and port are used) | 200 `{ ok: true, caldav, carddav, server: "mdaemon" \| "generic", details }`, where `caldav` and `carddav` are `{ url, via: "dns" \| "well-known" }` or `null` and `details` lists each step in French (8 s timeout); 422 `{ ok: false, error: "invalid", errors: { host } }` |
| `POST /support/api/password` | `{ current, next }` | 200 `{ ok: true }`; 401 wrong `current`; 422 `next` shorter than 12 characters |

When `/data` is not writable, `setup-done`, `upload` and `password` answer 409 `{ ok: false, error: "readonly" }`.

Static files are served from memory, with gzip for text. Assets requested with the current `?v=<hash>` are immutable for a year; HTML is `no-cache`. See [Reverse proxy and HTTPS](reverse-proxy.md#caching).

## Ports and paths

- Port `8080` (`PORT`) inside the container, published as `HOST_PORT`.
- The only things written to disk are in the `mccs-data` volume: `/data/config.json` (settings saved from the admin page), `/data/admin.json` (hashed admin password and "setup done" flag) and `/data/uploads/` (uploaded images, created on first upload).
- Application code is in `/app` (`server/` and `public/`) in the image.
