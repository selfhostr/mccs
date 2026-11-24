# Troubleshoot mccs

## The wizard shows `mail.example.com`

`MAIL_HOST` is not set yet. Set the mail servers in `/support` (Settings, or rerun the assistant). Check `/api/config` to see what the browser receives.

## `/support` answers 404

`/data` is not writable by the app user (uid 1000) and `SUPPORT_PASSWORD` is not set, so there is nowhere to keep a password. The logs say so at startup. With the compose file from v1.0.1, a host folder (`./mccs:/data`) is handed to uid 1000 by itself; with an older compose file, run `sudo chown -R 1000:1000 ./mccs` and `docker compose restart mccs`.

## I forgot the admin password

Run `docker compose exec mccs rm /data/admin.json && docker compose restart mccs && docker compose logs mccs`: a new password is generated and printed (if `SUPPORT_PASSWORD` is set, it works again instead).

## Sign-in succeeds but the sign-in page comes back

The browser dropped the session cookie because it is marked `Secure` while you use plain HTTP. Use HTTPS, or set `PUBLIC_URL` to the `http://` address you use.

## `/support` answers 429

Ten failed sign-ins from one address lock it for 15 minutes. Wait, or restart the container (the counters are in memory).

## The accent colour does not change

`BRAND_ACCENT` must be `#rgb` or `#rrggbb`; anything else falls back to the default ink-blue accent.

## My logo does not appear

`BRAND_LOGO_URL` must be a `/img/...` path of a file in the image, or an absolute http(s) URL. Anything else is ignored.

## A guide step shows no screenshot link

The link only appears when the file exists under `public/img/guides/` when the container starts. Add the file and rebuild.

## Look at the logs

```bash
docker compose logs --tail=100 mccs
```

The first line shows the port, the number of static files, the number of screenshots and whether `/support` is active.
