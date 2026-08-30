# AI Assistant Guide

Canonical guide for AI agents (Cursor, Claude Code, Gemini, etc.)
working on this repo. Keep this file authoritative; `CLAUDE.md`,
`GEMINI.md`, and `.cursorrules` should only point here for shared
content.

> Before suggesting solutions, check `docs/` for documented patterns
> and lessons learned.

## Project Overview

<!-- CUSTOMIZE: replace with your project description -->
React + TypeScript + Vite PWA, FastAPI (Python 3.11) backend, and
Docker for development and production. Small single-app starter for
installable applications, calculations, and simple local data.

### Tech Stack

- Backend: FastAPI (Python 3.11), Uvicorn
- Frontend: React + TypeScript + Vite, Tailwind CSS (dark mode)
- Containerization: Docker + Docker Compose v2
- Service worker: hand-rolled, build-version-stamped (`frontend/public/sw.js`)

## Development Philosophy

1. **Beginner-facing controls.** Keep `README.md` and default `make help`
   short, plain, and task-based. Put advanced details in `docs/` or
   `make help-all`.
2. **Ship first, optimize later.** Working features beat perfect code.
3. **User value over code beauty.** Don't refactor for taste.
4. **No premature abstraction.** Add a router/state lib/database when
   you actually need one, not before.
5. **Surgical changes.** Touch only what the task requires; respect
   existing conventions even if you'd write them differently.

## Architecture

```
project/
├── backend/          # FastAPI app
│   ├── main.py       # ASGI entrypoint
│   ├── app_factory.py# create_app(): middleware + routes
│   ├── api/          # route modules
│   ├── config/       # settings.py
│   ├── security.py   # API key + CORS + trusted-host middleware
│   ├── data/         # mounted runtime data
│   └── tests/        # unittest discover
├── frontend/         # React + Vite
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx                  # registers SW in production
│   │   ├── components/
│   │   ├── platform/                  # shared storage and notification lifecycle
│   │   ├── hooks/useServiceWorkerUpdate.ts
│   │   └── utils/version.ts
│   ├── public/sw.js                   # build-version-stamped
│   └── nginx.conf                     # production edge
├── .agents/skills/   # focused PWA and code-quality workflows
├── scripts/
│   └── doctor.sh                      # env/ports/docker validation
├── config/
│   └── env.example                    # copy to config/.env locally
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SOCKETS.md                     # WebSocket recipe + diagnosis
│   ├── PWA.md                         # PWA / service-worker checklist
│   └── RENDER.md                      # Render.com deploy playbook
├── render.yaml.example                # copy to render.yaml for Render deploy
├── docker-compose.yml                 # production-shaped local stack
├── docker-compose.dev.yml             # dev overrides (Vite, hot reload)
└── Makefile                           # opinionated entry points
```

## Development Workflow

```bash
make setup          # First-time setup
make dev            # Live reload, frontend on :3021, backend on :8065
make doctor         # Diagnose env/ports/docker/CORS BEFORE debugging
make stop / restart / logs
make rf / rb        # Restart one service
make rebuild-dev    # When deps change

# Production
make prod           # Production-shaped local run
make deploy         # Deploy on this host (~60s)
make deploy-front   # Frontend only (~10s, wipes old assets first)
make deploy-back    # Backend only (~20s)
make check          # Build frontend + run backend tests
```

## API Endpoints (default)

- `GET /` - root (version info)
- `GET /health` - liveness check
- `GET /api/docs` - OpenAPI docs
- `GET /api/health` - API health check consumed by the starter screen

<!-- CUSTOMIZE: add your endpoints here -->

## Port Configuration

| Service  | Dev URL              | Prod URL              |
|----------|----------------------|-----------------------|
| Frontend | http://localhost:3021 | http://localhost:8082 |
| Backend  | http://localhost:8065 | http://localhost:8065 |

## Environment Variables

Source of truth: [`config/env.example`](./config/env.example). Key vars:

| Variable | Purpose | Default |
|----------|---------|---------|
| `APP_API_KEY` | Protects non-browser callers; not user authentication | empty (disabled) |
| `CORS_ORIGINS` | Browser origins allowed to call the API. **Must include public hostnames in production.** | `http://localhost:3021,http://localhost:8082` |
| `TRUSTED_HOSTS` | Hostnames the FastAPI middleware trusts. Bare hosts only, no scheme. | `localhost,127.0.0.1` |
| `LOG_LEVEL` | Python logging level | `INFO` |
| `DEV_FRONTEND_PORT` | Vite development host port | `3021` |
| `BACKEND_PORT` / `FRONTEND_PORT` | Production-shaped host port overrides | `8065` / `8082` |

`make doctor` validates key drift, value shape, ports, Docker Compose support,
and the rendered Compose model. The API prefix is the fixed invariant `/api`.
Compose derives project, network, and container names from the checkout
directory unless the caller explicitly supplies a project name.

## Adding Features

### New backend route

1. Create `backend/api/my_feature.py` with an `APIRouter`.
2. Register it in `backend/app_factory.py`:
   `app.include_router(my_feature.router)`
3. Add a regression test in `backend/tests/`.

### New frontend component

Drop in `frontend/src/components/`, wire up in `App.tsx`. Add a router
library only when you actually have more than one page.

### Adding WebSockets

Read [`docs/SOCKETS.md`](./docs/SOCKETS.md) **before** installing
`python-socketio` or `socket.io-client`. Four changes are needed:
backend mount + CORS, security middleware bypass, nginx upgrade
headers, and correct client `path`/transports config. Skipping any one
of them causes silent production failures (UI hangs in initial state,
backend logs show `[accepted] -> connection closed` with no event
handlers firing).

### Deploying to Render.com

Read [`docs/RENDER.md`](./docs/RENDER.md) **before** touching
`render.yaml.example` or the backend `Dockerfile`. Render is a
supported deploy target (free-tier static frontend + Docker backend)
in addition to the self-hosted Docker workflow. Non-obvious rules:

- `plan: free` is REQUIRED on Docker web services, REJECTED on static sites.
- Raw `fetch('/api/...')` works locally and on nginx-proxied Docker but
  silently breaks on Render's split deploy. Always route API calls
  through `frontend/src/utils/api.ts` (or your axios instance built on
  `API_BASE_URL` from that module).
- The backend Dockerfile listens on internal port 8060 and honors `$PORT`
  when Render injects it. Local Compose maps host port 8065 to that internal
  port.
- `.dockerignore` allow-list MUST mirror `.gitignore` allow-list
  whenever runtime data is selectively committed; otherwise the image
  ships without it and the demo shows placeholders with no errors.

## Troubleshooting

Run `make doctor` first — it catches the majority of config-drift
problems before you start debugging code.

### Port already in use

```bash
docker ps                     # check container conflicts
lsof -nP -iTCP:3021 -sTCP:LISTEN  # find host process
```

### Slow Docker builds

1. Verify both `frontend/.dockerignore` and `backend/.dockerignore` exist.
2. Remove `node_modules` from git or rebuild context.
3. Clean: `docker system prune -af` (destructive — confirm first).

### TypeScript strict-mode errors

- TS6133: unused variables/imports — remove or prefix with `_`.
- Run `cd frontend && npm run build` locally before any Docker build.

### Browser shows old version after deploy

`docker cp` adds files but doesn't remove them. Old hashed assets
linger and the cached service worker keeps serving them. The included
`make deploy-front` wipes `/usr/share/nginx/html/*` first to prevent
this. If the user is still stuck:

- Use the in-app **Check for updates** action, then **Update now** when shown.
- Desktop: Cmd-Shift-R bypasses the worker for that fetch while diagnosing.
- Safari 26: use Develop → Inspect Apps and Devices → Automatically Inspect
  New Service Workers. See `docs/PWA.md` for the full release check.

## Repository Skills

Two portable, repository-local skills live in `.agents/skills/`:

- `pwa-app-design` for manifests, service workers, installed-mode UX,
  icons, safe areas, and PWA delivery checks.
- `code-quality` for review, TDD, regression tests, and ship readiness.

Deployment and troubleshooting instructions stay in this guide and
`docs/` because they apply broadly and should not require a skill.

## Cursor-specific: documentation placement

**When creating documentation files (`.md`):**

1. **Project documentation** → `/docs/`
   (e.g. `docs/DEPLOYMENT_GUIDE.md`, `docs/API_DOCUMENTATION.md`)
2. **Root-level exceptions only**:
   `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE.md`,
   `AGENTS.md` (and its symlinks `CLAUDE.md` / `GEMINI.md`).
3. **Never** create new docs at project root unless the file is one of
   the exceptions above.
4. Use descriptive UPPERCASE names for `/docs/` files.
5. Update `README.md` and `docs/README.md` when adding important docs.
