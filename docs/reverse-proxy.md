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
    The `/support` rate limiter keys on the `CF-Connecting-IP` header when present, otherwise on the socket address. Only expose the app through a proxy that sets or strips this header, otherwise clients can spoof it. Behind a plain proxy, all clients may share one address, so the lock applies to everyone.

## Caching

At startup a hash of all CSS and JS files (and `/brand.css`) is computed and injected as `?v=<hash>` into asset URLs in the HTML and into JS imports. Versioned assets are served as immutable for one year; HTML is `no-cache`. A restart with changed assets therefore invalidates browser caches automatically.

## Autoconfig for Thunderbird

To enable automatic discovery, point `autoconfig.example.com` at this app (or proxy `/mail/config-v1.1.xml` to it). The endpoint also answers at `/.well-known/autoconfig/mail/config-v1.1.xml`.
