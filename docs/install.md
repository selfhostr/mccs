# Install mccs

At the end you have the wizard answering on port 8080 and the admin area ready to set it up. The image `ghcr.io/selfhostr/mccs` is published for amd64 and arm64.

## Docker Compose

```bash
curl -O https://raw.githubusercontent.com/selfhostr/mccs/main/docker-compose.yml
docker compose up -d
docker compose logs mccs
```

The compose file holds only the image, the port, the `mccs-data` volume and the hardening: no `.env`, no variable. On the first start the logs print the admin user (`support`), a generated password and the address `http://<your-server>:8080/support`. Open it: the setup assistant takes it from there (see [Admin area](support-page.md)).

- To change the port, edit the `ports` line, for example `"8443:8080"`.
- Environment variables are still read by the server, as an advanced option: add them under `environment:` in the compose file (see [Configuration](configuration.md)).
- Update with `docker compose pull && docker compose up -d` (see [Upgrade](upgrading.md)).
- The image is based on `node:22-alpine` and runs as the `node` user, with a read-only filesystem, `no-new-privileges` and all capabilities dropped. A healthcheck calls `/healthz` every 30 seconds.
- Logs use the `json-file` driver, capped at 2 files of 5 MB.

Tags: `vX.Y.Z` releases publish `:X.Y.Z`, `:X.Y`, `:X` and `:latest`; the `main` branch publishes `:edge`.

To undo: `docker compose down`. The settings stay in the `mccs-data` volume; `docker compose down -v` removes them too.

## Build from source

```bash
git clone https://github.com/selfhostr/mccs.git && cd mccs
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

A local `docker-compose.override.yml` is ignored by git, so you can keep your own changes there.

## Without Docker

Node 20 or later is required (`engines` in `package.json`); the Dockerfile uses Node 22. There is nothing to install.

```bash
PORT=8080 MAIL_HOST=mail.example.com node server/index.js
```

## Put it online

mccs speaks plain HTTP. For real use, put it behind an HTTPS reverse proxy: see [Reverse proxy and HTTPS](reverse-proxy.md).
