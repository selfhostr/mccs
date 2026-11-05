# Security policy

mccs shows server settings to your customers and builds an Apple profile. It asks for no password and stores nothing, but a mistake in the profile, the headers or the `/support` page matters. Thank you for reporting one.

## Supported versions

There is no tagged release yet.

| Version | Supported |
|---|---|
| `main` | Yes |
| Latest tagged release, when there is one | Yes |
| Older tags | No, upgrade |

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub private vulnerability reporting: the repository's **Security** tab, then **Report a vulnerability** (<https://github.com/yetysw/mccs/security/advisories/new>).

Include the affected component, steps to reproduce, the impact as you understand it, and the commit you tested.

## What to expect

- An acknowledgement within 7 days.
- A first assessment within 14 days.
- A fix on `main`, then a published advisory. Reporters are credited unless they prefer not to be. Disclosure is coordinated: the advisory stays private until a fix is out.

These are goals, not guarantees. There is no bug bounty.

## Scope

In scope: the `/support` authentication and rate limit, the HTTP headers and CSP, the Apple profile and Thunderbird autoconfig generators (injection, escaping), input validation of the address and name, the Docker image and Compose file.

Out of scope: vulnerabilities in the mail servers or third-party apps the guides describe, reports that need control of the host, and automated scanner output without a demonstrated impact.

## Hardening notes

See [Security](docs/security.md) and [Reverse proxy and HTTPS](docs/reverse-proxy.md).
