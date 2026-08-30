<div align="center">

<img src="frontend/public/icon-192.png" width="96" alt="Beskar Forge forge icon">

# Beskar Forge

**Build a mobile-first PWA with React, FastAPI, and one Docker workflow.**

![Mobile-first PWA](https://img.shields.io/badge/PWA-Mobile--first-365F40)
![React and FastAPI](https://img.shields.io/badge/Stack-React%20%2B%20FastAPI-477652)
![Docker Compose](https://img.shields.io/badge/Run-Docker%20Compose-2496ED?logo=docker&logoColor=white)
[![MIT License](https://img.shields.io/badge/License-MIT-6B7D5C.svg)](LICENSE)

[Start the app](#start-the-app) · [Create your project](SETUP_PROMPT.md) ·
[Read the guides](#guides)

</div>

The repository ships a small offline-first field-notes workflow so a fresh
copy demonstrates local persistence, queued changes, and a working
frontend-to-backend sync request immediately. The fuller Garden Planner
application now lives in its own repository as another reference build:
[github.com/martin-gomola/garden-planner](https://github.com/martin-gomola/garden-planner).

## Why this exists

I kept needing a starting point for small applications: a mobile
interface, a working backend connection, safe configuration, a deployable
container, and a PWA update path. Rebuilding that foundation for every idea
made it harder to spend time on the actual user problem.

Beskar Forge turns that foundation into a starter that I can reuse with a
coding agent or adapt by hand. It is intentionally not a full-stack framework
or a universal SaaS platform. It is a practical baseline for applications such
as planners, calculators, internal tools, and homelab utilities.

It keeps the foundation visible: the defaults, trade-offs, and deployment and
update details that are easy to overlook when starting a new project.

The path from an application idea to a focused, installable tool is:

**agent prompt → focused workflow → PWA → API → Docker deployment**

It fits small applications where speed and portability matter more than
framework complexity.

## What you need

- Git
- Docker Desktop, OrbStack, or Docker Engine with Compose

You do not need to install Node.js or Python to start the app.

## Start the app

```bash
git clone https://github.com/martin-gomola/beskar-forge.git my-app
cd my-app
make setup
```

The first setup may take a few minutes while Docker downloads the base images.

Open [http://localhost:3021](http://localhost:3021).

`make setup` creates the local configuration, builds the containers, and starts
development mode. You only need it once.

If setup stops with an error, run:

```bash
make doctor
```

The command explains what is missing or which port is already in use.

## Commands you will use

| Command | Use it when |
| --- | --- |
| `make dev` | Start the app and reload it when code changes |
| `make stop` | Stop the app |
| `make logs` | See frontend and backend messages |
| `make check` | Build the frontend and run backend tests |
| `make doctor` | Diagnose Docker, port, or configuration problems |
| `make prod` | Test the production build on your computer |
| `make deploy` | Build and run the production version on the current server |

Run `make help` to see this short list in the terminal. Run `make help-all` for
less common commands.

## The reference workflow

The included Field Notes workflow demonstrates the platform boundary with a
small, useful domain flow:

- an installable PWA with user-controlled update handling;
- local-first note capture backed by IndexedDB;
- an outbox that queues creates, edits, and deletes while offline;
- idempotent FastAPI synchronization backed by SQLite;
- visible online, offline, queued, synced, and conflict states.

For a complete feature built from this template, see the [Garden Planner
reference application](https://github.com/martin-gomola/garden-planner).

The backend API documentation is available at
[http://localhost:8065/api/docs](http://localhost:8065/api/docs).

## Start your own project

The easiest option is to give [`SETUP_PROMPT.md`](./SETUP_PROMPT.md) to your
coding agent. Add your app name, destination folder, and first feature. The
agent will copy the template, rename it, run the checks, and report what is
ready.

If you prefer to customize it yourself:

1. Change the app name and description in
   `frontend/src/config/platform.ts`, `frontend/index.html`, and
   `frontend/public/manifest.json`.
2. Replace `frontend/src/features/field-notes/FieldNotesScreen.tsx` with your first screen,
   or keep its local-first storage pattern when the feature needs offline data.
   Keep `frontend/src/platform/` and `PlatformControls.tsx` for shared local-data
   clearing and explicit notification permission handling.
3. Add your API route under `backend/api/` and register it in
   `backend/app_factory.py`.
4. Run `make check`.

## Configuration

Edit `config/.env`, then run `make doctor`. The API path is always `/api`;
ports, browser origins, trusted hosts, and logging are configurable. Compose
derives container names from the project directory, so renamed copies do not
share container names.

`APP_API_KEY` protects scripts and other non-browser callers. It is not user
authentication for private application data.

## Privacy and crawler defaults

The starter is private by default for search and AI crawler discovery. It
ships a root [`robots.txt`](./frontend/public/robots.txt) that disallows all
crawlers, a `noindex` robots meta tag, and `X-Robots-Tag` headers for local
Nginx, Vite preview, and the Render static deployment.

These are signals for compliant crawlers, not access control. They do not stop
a scraper or a person who can reach the public URL. Do not put secrets or
sensitive data in the frontend bundle or browser storage. For genuinely
private data, add authentication and server-side authorization, or put both
frontend and backend behind a private access gateway or VPN. The Render
Blueprint is a public-demo deployment and should not be used as the privacy
boundary.

Do not add a `sitemap.xml` to a private fork. If you intentionally build a
public, indexable site from this starter, review and relax `robots.txt`, the
robots meta tag, the `X-Robots-Tag` headers, and the corresponding contract
checks as one deliberate change.

## Deploy

For a Docker server:

```bash
make deploy
```

For a public Render demo, the repository includes a ready-to-use
[`render.yaml`](./render.yaml) Blueprint. Review [`docs/RENDER.md`](./docs/RENDER.md)
for the dashboard steps and free-tier caveats.

Before making a Docker deployment public, set `CORS_ORIGINS`, `TRUSTED_HOSTS`,
and `APP_API_KEY` in `config/.env`. For Render, the Blueprint sets the public
origins and prompts for `APP_API_KEY` in the dashboard. Then run:

```bash
make check
make doctor
```

## Project folders

```text
frontend/   React, PWA files, and the Field Notes reference workflow
backend/    FastAPI routes and tests
config/     Local environment settings
docs/       PWA, WebSocket, architecture, and deployment guides
```

## Guides

- [PWA and mobile installation](./docs/PWA.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Render deployment](./docs/RENDER.md)
- [Adding WebSockets](./docs/SOCKETS.md)
- [All documentation](./docs/README.md)

## License

MIT
