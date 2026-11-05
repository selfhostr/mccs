# Contributing to mccs

Bug reports, guide fixes and presets for other mail servers are welcome. One topic per pull request.

## Run it

Everything runs in Docker, with no toolchain on your machine.

```bash
git clone https://github.com/yetysw/mccs.git && cd mccs
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:8080. Code or guide changes need `--build`; environment changes only need `docker compose up -d`.

## Checks

There is no automated test suite or CI yet. Before you open a pull request, check by hand:

- the wizard from address to a guide, on a desktop and at 390 px wide, with no horizontal scroll;
- dark and light, and keyboard only;
- `/support` with `SUPPORT_PASSWORD` set;
- nothing external is requested: the CSP forbids inline scripts, inline styles and third-party hosts.

## Conventions

- Node 22, built-in modules only: do not add an npm dependency without discussing it first.
- Colours come from the tokens in `public/css/app.css`, no hex in components. Status is never conveyed by colour alone.
- Guide texts use the mini syntax described in [docs/customize.md](docs/customize.md).
- The interface is in French. Keep it plain and in the formal register.
- No instance data in the code: everything goes through environment variables.

## Branches and commits

Branches are `feat/...`, `fix/...`, `docs/...` or `chore/...`, opened as a pull request against the default branch. Titles follow Conventional Commits (`fix(guides): correct the Outlook step 3`). Sign off your commits (`git commit -s`) to accept the Developer Certificate of Origin. UI pull requests include before and after screenshots.

## Public repository hygiene

Never commit secrets, captured data, real hostnames, addresses or customer names. Use `example.com`, `*.home.arpa` and the documentation ranges `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`.

## Security

Do not report vulnerabilities in public issues: see [SECURITY.md](SECURITY.md).
