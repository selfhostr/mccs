# Troubleshoot mccs

## The wizard shows `mail.example.com`

`MAIL_HOST` is not set, or `.env` is not next to `docker-compose.yml`. Fix it and run `docker compose up -d`. Check `/api/config` to see what the browser receives.

## `/support` answers 404

`SUPPORT_PASSWORD` is empty. Set it and restart.

## `/support` answers 429

Ten failed sign-ins from one address lock it for 15 minutes. Wait, or restart the container (the counters are in memory).

## The accent colour does not change

`BRAND_ACCENT` must be `#rgb` or `#rrggbb`; anything else falls back to `#2563eb`.

## My logo does not appear

`BRAND_LOGO_URL` must be a `/img/...` path of a file in the image, or an absolute http(s) URL. Anything else is ignored.

## A guide step shows no screenshot link

The link only appears when the file exists under `public/img/guides/` when the container starts. Add the file and rebuild.

## Look at the logs

```bash
docker compose logs --tail=100 mccs
```

The first line shows the port, the number of static files, the number of screenshots and whether `/support` is active.
