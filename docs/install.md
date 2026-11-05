# Install mccs

At the end you have the wizard answering on port 8080. No image is published yet: Docker builds it from the repository.

## Docker Compose

```bash
git clone https://github.com/yetysw/mccs.git && cd mccs
cp .env.example .env
```

Edit `.env` (at least `MAIL_HOST`, `PUBLIC_URL`, `BRAND_NAME`), then start it:

```bash
docker compose up -d --build
```

- Changing environment variables only needs `docker compose up -d`.
- Changing code, guides or images needs `docker compose up -d --build`.
- The host port is `HOST_PORT` (8080 by default) and maps to port 8080 in the container.
- The image is based on `node:22-alpine` and runs as the `node` user, with a read-only filesystem, `no-new-privileges` and all capabilities dropped. A healthcheck calls `/healthz` every 30 seconds.
- Logs use the `json-file` driver, capped at 2 files of 5 MB.

To undo: `docker compose down`. Nothing is written to disk, so there is nothing else to remove.

## Without Docker

Node 20 or later is required (`engines` in `package.json`); the Dockerfile uses Node 22. There is nothing to install.

```bash
PORT=8080 MAIL_HOST=mail.example.com PUBLIC_URL=https://config.example.com node server/index.js
```

## Put it online

mccs speaks plain HTTP. For real use, put it behind an HTTPS reverse proxy: see [Reverse proxy and HTTPS](reverse-proxy.md).
