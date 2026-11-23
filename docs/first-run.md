# First run

At the end you know that the wizard shows your own servers and that the admin area works.

1. Check that it is alive: `curl http://localhost:8080/healthz` answers `ok`.
2. Read the sign-in in the logs: `docker compose logs mccs`. Open `http://<your-server>:8080/support`, sign in as `support` with the generated password. The setup assistant opens; see [Admin area](support-page.md). A banner invites you to change the password: do it from the account menu.
3. Open `http://<your-server>:8080`, type an address on your domain and go through a guide. The IMAP and SMTP hosts, ports and security labels must be yours. If they are not, fix them in the admin's Settings tab (see [Configuration](configuration.md)).
4. Check `/api/config`: it is exactly what the browser receives, and contains nothing secret.

Before you announce it to customers, check that `PUBLIC_URL` is the address they will use (empty = the address used by the browser): links and QR codes are built from it.

## Back up

Keep the `mccs-data` volume (settings, hashed admin password and uploaded images) and any logo or screenshots you added.
