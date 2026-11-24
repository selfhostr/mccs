# Admin area (`/support`)

`/support` is where you set up the instance and generate customer links, from the browser. Nothing here needs a restart or a rebuild.

## Sign in

1. On the first start, mccs generates a password. Read it with `docker compose logs mccs`, together with the user (`support`) and the address `http://<your-server>:8080/support`.
2. Open `/support`. You land on `/support/login.html`; sign in.

The password is stored as a hash in `/data/admin.json` and kept in clear in `/data/initial-password` (mode 600). It is printed again at each start until you change it; a banner in the admin also invites you to. With `SUPPORT_PASSWORD` set (advanced option), nothing is generated and that value is the password.

The session lasts 8 hours after your last action. "Se déconnecter" in the account menu ends it.

The session cookie is marked `Secure` when the request arrives over HTTPS (`X-Forwarded-Proto: https`) or when `PUBLIC_URL` starts with `https:`. Its default value does, so if you open the admin over plain HTTP from another machine, set `PUBLIC_URL` to that `http://` address first, or the browser drops the cookie and the sign-in page comes back.

## Setup assistant

The first time you sign in, a five-step assistant opens: brand, mail servers (with a "Tester" button per server), calendar and contacts, accepted domains and support contact, then a summary. Nothing is saved before "Mettre en ligne" on the last step. Rerun it at any time with "Relancer l'assistant" in the Settings tab; it starts from the current values.

The server test opens a TLS connection to the host and port you typed (directly, or through `STARTTLS`), reads the greeting and checks the certificate. It sends no credentials.

At the calendar and contacts step, mccs looks for the CalDAV and CardDAV addresses of your server by itself (DNS, then `/.well-known`) and fills them in; "Détecter automatiquement" runs it again, for example after changing the server under "Avancé". There is no server type to choose: MDaemon is recognised, anything else is treated as a standard server. See [Configuration](configuration.md#automatic-detection).

## Tabs

- **Réglages**: every setting, grouped as in [Configuration](configuration.md). Each field shows where its value comes from (default, environment or saved here) and can go back to its default. "Annuler la dernière modification" restores the previous `config.json`.
- **Liens clients**: type the customer's address (name, device and application are optional), then copy the link or download the QR code as PNG or SVG, and pass it on through the channel of your choice. mccs sends nothing itself. The link points to `PUBLIC_URL`, so set it first.

The **Référencement** section of Réglages decides whether search engines may index the home page (off by default), and sets its title, description and link preview image, with a live Google result preview and link preview. Its "Copier le prompt pour une IA" button copies a prompt describing your setup to paste into a generative AI; paste the AI's answer back and "Remplir les champs" fills the fields for you to check and save. See [Configuration](configuration.md#search-engines-and-link-previews). The last step of the setup assistant points there.

Logo, background and link preview images can be uploaded: PNG, JPEG or WebP, 2 MB at most. They are stored in `/data/uploads/` and served from `/uploads/`. SVG is not accepted as an upload; an SVG logo can still be used by URL.

## Password

"Changer le mot de passe" in the account menu replaces the generated password (or `SUPPORT_PASSWORD`) with one of at least 12 characters. It is stored as a scrypt hash in `/data/admin.json`. The clear copy in `/data/initial-password` is deleted and the reminder in the logs disappears. From then on `SUPPORT_PASSWORD` no longer works, and other open sessions are closed.

**Forgotten password:**

```bash
docker compose exec mccs rm /data/admin.json && docker compose restart mccs && docker compose logs mccs
```

A new password is generated and printed (unless `SUPPORT_PASSWORD` is set, which then works again). The setup assistant opens again at the next sign-in, since the "setup done" flag lives in the same file.

## Turning it off

`/support` is always on, protected by the password and the lock-out rules (see [Security](security.md)). It only answers 404 when `/data` is not writable and `SUPPORT_PASSWORD` is not set, since there is nowhere to keep a password.
