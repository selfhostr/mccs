# Upgrade mccs

At the end you run the latest code with your settings unchanged.

```bash
git pull
docker compose up -d --build
```

Your settings live in `.env` and in the `mccs-data` volume (settings saved from the admin page, `config.json`). Neither is touched by an upgrade. Back up both:

```bash
cp .env .env.bak
docker run --rm -v mccs_mccs-data:/data -v "$PWD":/backup alpine tar czf /backup/mccs-data.tgz -C /data .
```

The volume name is prefixed by the compose project name (`mccs_` by default); `docker volume ls` shows it.

Before 1.0, variable names and endpoints can still change between versions. Read the release notes on the [releases page](https://github.com/selfhostr/mccs/releases) before upgrading.

To go back, check out the previous tag or commit and rebuild.

!!! note
    The default image and container name changed from `mail-setup` to `mccs`. If you relied on the old container name in scripts, set `CONTAINER_NAME` and `IMAGE_NAME` in `.env`.
