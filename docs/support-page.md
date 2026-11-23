# Admin area (`/support`)

`/support` is where you set up the instance and generate customer links, from the browser. Nothing here needs a restart or a rebuild.

## Sign in

1. Set `SUPPORT_PASSWORD` (and optionally `SUPPORT_USER`, default `support`) and restart with `docker compose up -d`.
2. Open `/support`. You land on `/support/login.html`; sign in with `SUPPORT_USER` and `SUPPORT_PASSWORD`.

The session lasts 8 hours after your last action. "Se déconnecter" in the account menu ends it.

The session cookie is marked `Secure` when the request arrives over HTTPS (`X-Forwarded-Proto: https`) or when `PUBLIC_URL` starts with `https:`. Its default value does, so if you open the admin over plain HTTP from another machine, set `PUBLIC_URL` to that `http://` address first, or the browser drops the cookie and the sign-in page comes back.

## Setup assistant

The first time you sign in, a five-step assistant opens: brand, mail servers (with a "Tester" button per server), calendar and contacts, accepted domains and support contact, then a summary. Nothing is saved before "Mettre en ligne" on the last step. Rerun it at any time with "Relancer l'assistant" in the Settings tab; it starts from the current values.

The server test opens a TLS connection to the host and port you typed (directly, or through `STARTTLS`), reads the greeting and checks the certificate. It sends no credentials.

At the calendar and contacts step, mccs looks for the CalDAV and CardDAV addresses of your server by itself (DNS, then `/.well-known`) and fills them in; "Détecter automatiquement" runs it again, for example after changing the server under "Avancé". There is no server type to choose: MDaemon is recognised, anything else is treated as a standard server. See [Configuration](configuration.md#automatic-detection).

## Tabs

- **Réglages**: every setting, grouped as in [Configuration](configuration.md). Each field shows where its value comes from (default, `.env` or saved here) and can go back to its default. "Annuler la dernière modification" restores the previous `config.json`.
- **Liens clients**: type the customer's address (name, device and application are optional), then copy the link or download the QR code as PNG or SVG, and pass it on through the channel of your choice. mccs sends nothing itself. The link points to `PUBLIC_URL`, so set it first.

Logo and background images can be uploaded: PNG, JPEG or WebP, 2 MB at most. They are stored in `/data/uploads/` and served from `/uploads/`. SVG is not accepted as an upload; an SVG logo can still be used by URL.

## Password

"Changer le mot de passe" in the account menu replaces `SUPPORT_PASSWORD` with a password of at least 12 characters. It is stored as a scrypt hash in `/data/admin.json`, never in clear. From then on `SUPPORT_PASSWORD` no longer works, and other open sessions are closed.

**Forgotten password:** delete `/data/admin.json` (for example `docker compose exec mccs rm /data/admin.json`). `SUPPORT_PASSWORD` works again at once. The setup assistant opens again at the next sign-in, since the "setup done" flag lives in the same file.

## Turning it off

Empty `SUPPORT_PASSWORD` and delete `/data/admin.json`: `/support` then answers 404. See [Security](security.md) for the lock-out rules.
