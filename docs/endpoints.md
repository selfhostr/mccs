# Endpoints

Only `GET` and `HEAD` are accepted; anything else gets 405.

| Path | Purpose |
|---|---|
| `/` | Wizard. Query params: `email`, `name`, `device` (`windows`, `macos`, `ios`, `android`), `app` (guide id, e.g. `ios-profile`, `outlook-classic`, `caldavsync`, `davx5`) |
| `/support` | Internal page (Basic auth): link and QR generator, PNG/SVG export, pre-written email/SMS. 404 while `SUPPORT_PASSWORD` is empty |
| `/profile.mobileconfig?email=&name=&services=mail,calendar,contacts` | Unsigned Apple profile, no password; 400 on invalid email |
| `/mail/config-v1.1.xml?emailaddress=` | Thunderbird autoconfig (also at `/.well-known/autoconfig/mail/`) |
| `/api/config` | Public settings, read by the browser; nothing secret |
| `/brand.css` | Generated accent colour |
| `/healthz` | Health check, answers `ok` |

Static files are served from memory, with gzip for text. Assets requested with the current `?v=<hash>` are immutable for a year; HTML is `no-cache`. See [Reverse proxy and HTTPS](reverse-proxy.md#caching).

## Ports and paths

- Port `8080` (`PORT`) inside the container, published as `HOST_PORT`.
- Nothing is written to disk: no data directory, no volume.
- Application code is in `/app` (`server/` and `public/`) in the image.
