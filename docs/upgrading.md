# Upgrade mccs

At the end you run the latest image with your settings unchanged.

```bash
docker compose pull
docker compose up -d
```

Your settings live in the `mccs-data` volume (settings saved from the admin page, `config.json`). An upgrade does not touch it. Back it up:

```bash
docker run --rm -v mccs_mccs-data:/data -v "$PWD":/backup alpine tar czf /backup/mccs-data.tgz -C /data .
```

The volume name is prefixed by the compose project name (`mccs_` by default); `docker volume ls` shows it.

`:latest` follows the newest release. To stay on a line, pin the tag in `docker-compose.yml` (`:1.0.0`, `:1.0` or `:1`); `:edge` follows the `main` branch.

Before 1.0, variable names and endpoints can still change between versions. Read the release notes on the [releases page](https://github.com/selfhostr/mccs/releases) before upgrading.

To go back, pin the previous tag and run `docker compose up -d`.

If you build from source, run `git pull` then `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.
