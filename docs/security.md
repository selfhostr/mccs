# Security

## Design

- No password is asked, sent to or stored by this app. Users type it only in their own mail client.
- No cookies on the customer site, no analytics, no tracking, no third-party requests. The only cookie is the admin session, limited to `/support` (see below).
- The QR code is generated locally in the browser (`public/js/qr.js`, MIT, after Nayuki's implementation).
- Only GET and HEAD are accepted, except POST and PUT on `/support/api/*`.

## HTTP headers

Content-Security-Policy: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`. A remote logo origin is appended to `img-src` only when `BRAND_LOGO_URL` is an absolute URL.

Also sent: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`.

## The /support admin area

- Disabled (404) while `SUPPORT_PASSWORD` is empty and no password has been saved in `/data/admin.json`.
- Sign-in form, then a session cookie `mccs_admin`: random 256-bit token, `HttpOnly`, `SameSite=Strict`, `Path=/support` (never sent to the customer site), `Max-Age` 8 hours, sliding. `Secure` when the request arrives over HTTPS (`X-Forwarded-Proto: https`) or `PUBLIC_URL` is `https:`. Sessions live in memory (1000 at most): a restart signs everyone out.
- Credentials are compared in constant time. A password changed in the admin is stored as a scrypt hash (16-byte salt) in `/data/admin.json` (mode 600), never in clear and never logged. Changing it closes the other sessions.
- 10 failed attempts from one address within 15 minutes lock sign-in (and password change) for that address until the window ends (HTTP 429).
- Every POST and PUT must carry an `Origin` header naming this server (`http(s)://` + `Host`, or the origin of `PUBLIC_URL`); anything else gets 403. JSON bodies are limited to 64 KB, uploads to 2 MB; the server stops reading as soon as the limit is crossed (413).
- Uploads: PNG, JPEG or WebP only, checked by their magic bytes, not only the declared type; SVG is refused. Files get a random name (`logo-<16 hex>.png`) and `/uploads/` serves only names of that exact form, with `X-Content-Type-Options: nosniff`, so no path traversal is possible.
- The server test (`/support/api/probe`) connects only to the host and port sent, validated with the same rules as the settings, verifies the certificate and sends no credentials. It is available to signed-in admins only.
- Responses carry `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.
- The client address comes from `CF-Connecting-IP` if present, so only expose the app behind a proxy that controls this header.

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

- It does not check that the servers it describes are reachable or correctly configured.
- The Apple profile is unsigned, see above.
- `/support` is one shared admin account: serve it over HTTPS only, and treat the password like any admin credential. Anyone who can write to `/data` can reset it by deleting `admin.json`.
- There are no published releases or images yet, so there is nothing to verify with a signature. Build from a tag or commit you have read.

## Reporting

Do not open a public issue. Use GitHub private vulnerability reporting: <https://github.com/selfhostr/mccs/security/advisories/new>. See [SECURITY.md](https://github.com/selfhostr/mccs/blob/main/SECURITY.md).
