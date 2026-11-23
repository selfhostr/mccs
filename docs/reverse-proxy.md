# Reverse proxy and HTTPS

At the end customers reach mccs over HTTPS on your own address.

Run mccs behind an HTTPS reverse proxy and proxy to `127.0.0.1:8080`.

Caddy:

```
config.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

nginx:

```nginx
server {
    listen 443 ssl;
    server_name config.example.com;
    # ssl_certificate / ssl_certificate_key ...
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set `PUBLIC_URL` to the same address.

!!! warning
    The `/support` rate limiter, and the per-IP limit of the optional password check (`/api/test`), key on the connection's address by default. Behind a proxy, set `TRUSTED_PROXY_HEADER` to the header your proxy sets: `CF-Connecting-IP` behind Cloudflare, or `X-Forwarded-For` behind nginx or Caddy (only the last address, the one added by your proxy, is used). Never set it when clients can reach the app directly: they could then spoof the header. Without it, all clients behind the proxy share one address, so the lock applies to everyone.

## Caching

At startup a hash of all CSS and JS files is computed and injected as `?v=<hash>` into asset URLs in the HTML and into JS imports. Versioned assets are served as immutable for one year; HTML is `no-cache`. A restart with changed assets therefore invalidates browser caches automatically. `/brand.css` follows the saved settings, so it is never versioned and always served `no-cache`: do not cache it longer in your proxy.

## Autoconfig for Thunderbird

To enable automatic discovery, point `autoconfig.example.com` at this app (or proxy `/mail/config-v1.1.xml` to it). The endpoint also answers at `/.well-known/autoconfig/mail/config-v1.1.xml`.
