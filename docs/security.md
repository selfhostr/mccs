# Security

## Design

- By default no password is asked, sent to or stored by this app: users type it only in their own mail client. The optional password check (off by default, below) is the only exception.
- No cookies on the customer site, no analytics, no tracking, no third-party requests. The only cookie is the admin session, limited to `/support` (see below).
- The QR code is generated locally in the browser (`public/js/qr.js`, MIT, after Nayuki's implementation).
- Only GET and HEAD are accepted, except POST and PUT on `/support/api/*` and POST on `/api/test` (when the password check is on).

## HTTP headers

Content-Security-Policy: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`. A remote logo origin is appended to `img-src` only when `BRAND_LOGO_URL` is an absolute URL.

Also sent: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`.

## The /support admin area

- Always on, behind the password. Disabled (404) only when `/data` is not writable and `SUPPORT_PASSWORD` is empty. On first start a random password is generated; its hash goes to `/data/admin.json` and the clear text to `/data/initial-password` (mode 600), reminded in the logs until the admin changes it, then deleted.
- Sign-in form, then a session cookie `mccs_admin`: random 256-bit token, `HttpOnly`, `SameSite=Strict`, `Path=/support` (never sent to the customer site), `Max-Age` 8 hours, sliding. `Secure` when the request arrives over HTTPS (`X-Forwarded-Proto: https`) or `PUBLIC_URL` is `https:`. Sessions live in memory (1000 at most): a restart signs everyone out.
- Credentials are compared in constant time. A password changed in the admin is stored as a scrypt hash (16-byte salt) in `/data/admin.json` (mode 600), never in clear and never logged. Changing it closes the other sessions.
- 10 failed attempts from one address within 15 minutes lock sign-in (and password change) for that address until the window ends (HTTP 429).
- Every POST and PUT must carry an `Origin` header naming this server (`http(s)://` + `Host`, or the origin of `PUBLIC_URL`); anything else gets 403. JSON bodies are limited to 64 KB, uploads to 2 MB; the server stops reading as soon as the limit is crossed (413).
- Uploads: PNG, JPEG or WebP only, checked by their magic bytes, not only the declared type; SVG is refused. Files get a random name (`logo-<16 hex>.png`) and `/uploads/` serves only names of that exact form, with `X-Content-Type-Options: nosniff`, so no path traversal is possible.
- The server test (`/support/api/probe`) connects only to the host and port sent, validated with the same rules as the settings, verifies the certificate and sends no credentials. It is available to signed-in admins only.
- The CalDAV/CardDAV discovery (`/support/api/discover`) reads the DNS SRV/TXT records of the host and its parent domain, then sends `PROPFIND` and `OPTIONS` requests (no credentials, no cookie) to `https://` addresses only, with a verified certificate, at most 5 redirections, an 8-second budget, 16 KB of headers and 64 KB of body per response, and only status codes and DAV headers are reported back. It is available to signed-in admins only. It does **not** block private or loopback addresses: if a public name resolves to an internal address (split DNS, or a DNS record pointing inside your network), mccs will contact that internal address. This is deliberate, since many self-hosted DAV servers live on internal addresses; it only reveals whether an HTTPS DAV service answers there. If your admin accounts are not fully trusted, filter the container's outgoing traffic.
- Responses carry `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.
- The client address is the connection's address, or the header named by `TRUSTED_PROXY_HEADER` (`CF-Connecting-IP`, or the last `X-Forwarded-For` entry) when you set it. Set it only behind a proxy that controls that header.
- Concurrent login attempts are counted before the password is checked: at most 10 passwords per address and per 15-minute window, even when sent in parallel.
- An unreadable or unknown-version `admin.json` blocks admin login (HTTP 503) instead of silently falling back to `SUPPORT_PASSWORD`. Fix or delete the file; deleting it generates a new password at the next start (or re-enables `SUPPORT_PASSWORD` if set).
- The server test on the admin page can reach any host and port the container can reach, including internal ones. Only trusted administrators should have the admin password.

## Optional password check

Off by default. When an admin turns on "Vérifier le mot de passe des clients" (`CONNECTION_TEST`), the home page also asks for the mailbox password and `POST /api/test` checks it before the customer sets up a device.

What it does:

- It connects **only** to the IMAP and SMTP servers configured in the admin (`IMAP_HOST`/`IMAP_PORT`/`IMAP_SECURITY`, same for SMTP). Nothing in the request can change the host, port or security: the endpoint is not a proxy.
- IMAP: TLS (or STARTTLS, as configured) with a verified certificate and at least TLS 1.2, then `LOGIN` and `LOGOUT`. The password is sent as an IMAP quoted string (with `\` and `"` escaped) when it is printable ASCII, otherwise as a literal `{n}`, so quotes, backslashes, accents and spaces arrive unchanged. No credential is sent before TLS is up; bytes received before a STARTTLS handshake abort the test.
- SMTP: only **after** a successful IMAP login, so a wrong password counts once on your mail server. `EHLO`, `STARTTLS` if configured, `AUTH PLAIN` (or `AUTH LOGIN` when only that is offered), then `QUIT`. No message is ever sent (`MAIL`, `RCPT` and `DATA` are never issued).
- Each service has an 8-second budget. The answer gives one status per service: `ok`, `auth_failed`, `blocked` (the server's reply says the account or address is locked, blocked, banned, or refuses the connection at greeting), `unreachable`, `tls_error`, `timeout`, `error`, and `skipped` for SMTP when IMAP failed.

What is never kept:

- The password is never logged, never returned to the browser, never written to disk and never put in a URL, a cookie, browser storage, the QR code or the history. In the browser it is read from the field once, the field is cleared immediately, and it is not kept in the page state; it is never shown again.
- On the server, the raw request body is zeroed once parsed, the password is copied into a buffer that is zeroed after the test, and every network write that carries it is zeroed once handed to the socket. JavaScript strings cannot be wiped: the parsed string, and the base64 strings built for SMTP authentication, are dropped as soon as possible and left to the garbage collector.
- Server replies are not logged. An internal error logs one line without the error message (only an error code), since a message could carry request data.

Protection against abuse:

- The endpoint answers 404 while the option is off, and checks `Origin` (this server or `PUBLIC_URL`, otherwise 403), `Content-Type: application/json` (415) and a body of 8 KB at most (413).
- `ALLOWED_DOMAINS` applies: an address outside those domains gets 403 `{ "error": "domain" }` without any connection.
- Attempts are counted **before** connecting, per email address (`CONNECTION_TEST_MAX_PER_EMAIL`, 5 by default) and per client IP (`CONNECTION_TEST_MAX_PER_IP`, 20 by default) over 15 minutes, synchronously, so parallel requests cannot exceed the limits. Over the limit: 429 `{ "error": "rate_limited", "retryAfter" }`. The client IP follows `TRUSTED_PROXY_HEADER`, as for the admin. At most 50 checks run at once on the instance (503 beyond).
- The counters live in memory: a restart resets them.

### Whitelist mccs on your mail server

A browser cannot speak IMAP or SMTP, so every check is made by the mccs server, and all of them come from **one IP address**: the one mccs uses to reach your mail server. Brute-force protections (fail2ban, Dovecot auth penalties, MDaemon Dynamic Screening, Postfix/anvil rate limits...) see many wrong passwords from that single address and may block it, after which no customer can check their connection, sometimes for hours. Add the mccs address to the allow list of that protection before turning the option on. With MDaemon: Security > Dynamic Screening > Dynamic Allow List. mccs's own per-address and per-IP limits reduce, but do not remove, this risk. Keep `CONNECTION_TEST_MAX_PER_EMAIL` below your server's lock threshold.

Because of the whitelist, an attacker could use the check to try passwords for your accounts without hitting your server's own protection: the per-address and per-IP limits are then the only brake. Keep them low, and set `ALLOWED_DOMAINS` to your own domains.

## Apple profile

`/profile.mobileconfig` is not signed, so iOS and macOS display "Not signed" when installing it. It contains no password. Signing it is recommended in production, for example:

```bash
openssl smime -sign -signer cert.pem -inkey key.pem -certfile chain.pem \
  -nodetach -outform der -in profile.mobileconfig -out signed.mobileconfig
```

The server does not sign on the fly; sign at a dedicated step or in front of the app, using a certificate trusted by Apple devices.

## Deployment hardening

Run behind an HTTPS reverse proxy (see [Reverse proxy and HTTPS](reverse-proxy.md)). The container is non-root, read-only, with all capabilities dropped and `no-new-privileges`.

## What it does not protect

- Unless the optional password check is on, it does not check that the servers it describes are reachable or correctly configured.
- The Apple profile is unsigned, see above.
- `/support` is one shared admin account: serve it over HTTPS only, and treat the password like any admin credential. Anyone who can write to `/data` can reset it by deleting `admin.json`.
- There are no published releases or images yet, so there is nothing to verify with a signature. Build from a tag or commit you have read.

## Reporting

Do not open a public issue. Use GitHub private vulnerability reporting: <https://github.com/selfhostr/mccs/security/advisories/new>. See [SECURITY.md](https://github.com/selfhostr/mccs/blob/main/SECURITY.md).
