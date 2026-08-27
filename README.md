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

The repository ships a small connected starter screen so a fresh copy has a
working frontend-to-backend request immediately. The fuller Garden Planner
application now lives in its own repository as a reference build:
[github.com/martin-gomola/garden-planner](https://github.com/martin-gomola/garden-planner).

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

Open [http://localhost:3020](http://localhost:3020).

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

## The starter app

The starter screen shows the platform boundary without adding app-specific
domain code:

- an installable PWA with update handling;
- a mobile-first interface with visible keyboard focus;
- a frontend request to `GET /api/health` through the shared API helper;
- loading, connected, error, and retry states;
- a FastAPI health endpoint with no database or extra service.

For a complete feature built from this template, see the [Garden Planner
reference application](https://github.com/martin-gomola/garden-planner).

The backend API documentation is available at
[http://localhost:8062/api/docs](http://localhost:8062/api/docs).

## Start your own project

The easiest option is to give [`SETUP_PROMPT.md`](./SETUP_PROMPT.md) to your
coding agent. Add your app name, destination folder, and first feature. The
agent will copy the template, rename it, run the checks, and report what is
ready.

If you prefer to customize it yourself:

1. Change the app name and description in
   `frontend/src/config/platform.ts`, `frontend/index.html`, and
   `frontend/public/manifest.json`.
2. Replace `frontend/src/components/StarterScreen.tsx` with your first screen.
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
frontend/   React, PWA files, and the starter screen
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
