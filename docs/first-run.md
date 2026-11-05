# First run

At the end you know that the wizard shows your own servers and that the support page works.

1. Check that it is alive: `curl http://localhost:8080/healthz` answers `ok`.
2. Open `http://localhost:8080`, type an address on your domain and go through a guide. The IMAP and SMTP hosts, ports and security labels must be yours. If they are not, fix `MAIL_HOST` and the related variables in [Configuration](configuration.md).
3. Open the settings panel in the page header ("Paramètres" in the French interface): it lists the same values, grouped, for advanced users.
4. Check `/api/config`: it is exactly what the browser receives, and contains nothing secret.
5. Set `SUPPORT_PASSWORD` in `.env`, run `docker compose up -d`, then open `/support` and sign in with `SUPPORT_USER` (`support` by default). Until a password is set, `/support` answers 404.

Before you announce it to customers, set `PUBLIC_URL` to the address they will use: links and QR codes are built from it.

## Back up

Nothing is stored by the application. Keep your `.env` (it holds `SUPPORT_PASSWORD`; it is never committed) and any logo or screenshots you added.
