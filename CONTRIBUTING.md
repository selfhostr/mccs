# Contributing to mccs

Bug reports, guide fixes and presets for other mail servers are welcome. One topic per pull request.

## Run it

Everything runs in Docker, with no toolchain on your machine.

```bash
git clone https://github.com/selfhostr/mccs.git && cd mccs
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Open http://localhost:8080. Code or guide changes need `--build`. A local `docker-compose.override.yml` is ignored by git. The admin password is printed by `docker compose logs mccs`.

## Checks

CI syntax-checks the scripts, runs the unit tests (`npm test`) and smoke-tests the Docker image. Before you open a pull request, check by hand:

- the wizard from address to a guide, on a desktop and at 390 px wide, with no horizontal scroll;
- dark and light, and keyboard only;
- `/support`: first start (generated password in the logs) and the settings;
- nothing external is requested: the CSP forbids inline scripts, inline styles and third-party hosts.

## Conventions

- Node 22, built-in modules only: do not add an npm dependency without discussing it first.
- Colours come from the tokens in `public/css/app.css`, no hex in components. Status is never conveyed by colour alone.
- Guide texts use the mini syntax described in [docs/customize.md](docs/customize.md).
- The interface is in French. Keep it plain and in the formal register.
- No instance data in the code: everything goes through the settings saved from `/support` or environment variables.

## Branches and commits

Branches are `feat/...`, `fix/...`, `docs/...` or `chore/...`, opened as a pull request against the default branch. Titles follow Conventional Commits (`fix(guides): correct the Outlook step 3`). Sign off your commits (`git commit -s`) to accept the Developer Certificate of Origin.

## Public repository hygiene

Never commit secrets, captured data, real hostnames, addresses or customer names. Use `example.com`, `*.home.arpa` and the documentation ranges `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`.

## Security

Do not report vulnerabilities in public issues: see [SECURITY.md](SECURITY.md).
