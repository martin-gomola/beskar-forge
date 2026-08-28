# Beskar Forge - Project Boilerplate
# Replace "beskar-forge" with your project name throughout

.PHONY: help help-all ensure-env setup check check-local test dev prod stop restart restart-frontend restart-backend logs rebuild rebuild-dev rebuild-frontend rebuild-backend clean status deploy deploy-front deploy-back commit rf rb doctor

# Compose environment handling:
# - Compose only auto-loads a root `.env`
# - This repo keeps an example at `config/env.example`
# - If you create `config/.env`, the Makefile passes it to compose
#
# Docker Compose v2.24.4+ is required for the development override syntax.
# Override COMPOSE_CMD only with a compatible `docker compose` command.
ENV_FILE := config/.env
BACKEND_HOST_PORT := $(if $(BACKEND_PORT),$(BACKEND_PORT),$(shell awk -F= '$$1 == "BACKEND_PORT" { print $$2; exit }' $(ENV_FILE) 2>/dev/null))
BACKEND_HOST_PORT := $(if $(strip $(BACKEND_HOST_PORT)),$(strip $(BACKEND_HOST_PORT)),8062)
FRONTEND_HOST_PORT := $(if $(FRONTEND_PORT),$(FRONTEND_PORT),$(shell awk -F= '$$1 == "FRONTEND_PORT" { print $$2; exit }' $(ENV_FILE) 2>/dev/null))
FRONTEND_HOST_PORT := $(if $(strip $(FRONTEND_HOST_PORT)),$(strip $(FRONTEND_HOST_PORT)),8082)
DEV_FRONTEND_HOST_PORT := $(if $(DEV_FRONTEND_PORT),$(DEV_FRONTEND_PORT),$(shell awk -F= '$$1 == "DEV_FRONTEND_PORT" { print $$2; exit }' $(ENV_FILE) 2>/dev/null))
DEV_FRONTEND_HOST_PORT := $(if $(strip $(DEV_FRONTEND_HOST_PORT)),$(strip $(DEV_FRONTEND_HOST_PORT)),3021)
COMPOSE_CMD ?= docker compose
COMPOSE := $(COMPOSE_CMD)
ifneq ("$(wildcard $(ENV_FILE))","")
COMPOSE := $(COMPOSE_CMD) --env-file $(ENV_FILE)
endif
SETUP_COMPOSE := $(COMPOSE_CMD) --env-file $(ENV_FILE)
DEV_COMPOSE := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
SETUP_DEV_COMPOSE := $(SETUP_COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml

# Enable Docker BuildKit for faster, parallel builds with better caching
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_PROGRESS=auto

# Compose v2 honors COMPOSE_BAKE for parallel buildx bake builds.
export COMPOSE_BAKE=true

# Default target
help:
	@echo "Beskar Forge"
	@echo ""
	@echo "First time"
	@echo "  make setup    Set up and start the app"
	@echo ""
	@echo "Everyday commands"
	@echo "  make dev      Start development mode"
	@echo "  make stop     Stop the app"
	@echo "  make logs     Show app messages"
	@echo "  make check    Build the frontend and run backend tests"
	@echo "  make doctor   Diagnose setup problems"
	@echo "  make prod     Test the production build"
	@echo "  make deploy   Run the production version on this server"
	@echo ""
	@echo "Development app: http://localhost:$(DEV_FRONTEND_HOST_PORT)"
	@echo "API docs:        http://localhost:$(BACKEND_HOST_PORT)/api/docs"
	@echo ""
	@echo "More commands: make help-all"

help-all:
	@echo "Less common commands"
	@echo ""
	@echo "  make restart            Restart development mode"
	@echo "  make status             Show container and health status"
	@echo "  make test               Run backend tests"
	@echo "  make check-local        Run checks with local Node.js and Python"
	@echo "  make rebuild-dev        Rebuild development containers"
	@echo "  make rebuild-frontend   Rebuild only the frontend container"
	@echo "  make rebuild-backend    Rebuild only the backend container"
	@echo "  make deploy-front       Deploy only frontend files"
	@echo "  make deploy-back        Deploy only the backend container"
	@echo "  make deploy-clean       Rebuild production without cache"
	@echo "  make clean              Remove this project's containers and images"
	@echo "  make commit             Create a local Git commit"

ensure-env:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		cp config/env.example "$(ENV_FILE)"; \
		echo "Created $(ENV_FILE)"; \
	fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LOCALHOST DEVELOPMENT COMMANDS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setup: ensure-env
	@echo "Building and starting the app..."
	@echo "The first setup may take a few minutes."
	@BUILDKIT_PROGRESS=quiet $(SETUP_DEV_COMPOSE) up -d --build --wait
	@echo ""
	@echo "Ready."
	@echo "  App:       http://localhost:$(DEV_FRONTEND_HOST_PORT)"
	@echo "  Backend:   http://localhost:$(BACKEND_HOST_PORT)"
	@echo "  API docs:  http://localhost:$(BACKEND_HOST_PORT)/api/docs"

check: ensure-env
	@bash scripts/test_doctor.sh
	@bash scripts/test_compose_config.sh
	@echo "Preparing check containers..."
	@BUILDKIT_PROGRESS=quiet $(SETUP_DEV_COMPOSE) build frontend backend
	@echo "Checking the frontend..."
	@$(SETUP_DEV_COMPOSE) run --rm --no-deps -e NODE_ENV=production -e NPM_CONFIG_UPDATE_NOTIFIER=false frontend npm run build
	@echo "Testing the backend..."
	@$(SETUP_DEV_COMPOSE) run --rm --no-deps -e LOG_LEVEL=ERROR backend python -m unittest discover -s tests
	@echo "Checks passed"

check-local:
	@echo "Running checks with local tools..."
	@if [ ! -d "frontend/node_modules" ]; then \
		echo "Installing frontend packages..."; \
		cd frontend && npm ci; \
	fi
	@cd frontend && npm run build
	@cd backend && python -m unittest discover -s tests
	@echo "Checks passed"

test: ensure-env
	@echo "Testing the backend..."
	@BUILDKIT_PROGRESS=quiet $(SETUP_DEV_COMPOSE) build backend
	@$(SETUP_DEV_COMPOSE) run --rm --no-deps -e LOG_LEVEL=ERROR backend python -m unittest discover -s tests

doctor:
	@bash scripts/doctor.sh

prod: ensure-env
	@echo "Building & starting production mode..."
	@BUILDKIT_PROGRESS=quiet $(COMPOSE) up -d --build
	@echo ""
	@echo "Frontend: http://localhost:$(FRONTEND_HOST_PORT) (nginx, production build)"
	@echo "Backend:  http://localhost:$(BACKEND_HOST_PORT)"

dev: ensure-env
	@echo "Starting development mode..."
	@$(SETUP_DEV_COMPOSE) up -d
	@echo ""
	@echo "Frontend: http://localhost:$(DEV_FRONTEND_HOST_PORT) (Vite dev server)"
	@echo "Backend:  http://localhost:$(BACKEND_HOST_PORT) (live reload)"
	@echo ""
	@echo "Code changes reload automatically."
	@echo "Changed a dependency? Run: make rebuild-dev"

stop:
	@echo "Stopping all services..."
	@$(COMPOSE) down 2>/dev/null || $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true
	@echo "All services stopped"

restart:
	@echo "Quick restart (no rebuild)..."
	@make stop
	@make dev

rf:
	@echo "Restarting frontend only..."
	$(DEV_COMPOSE) restart frontend
	@echo "Frontend restarted!"

rb:
	@echo "Restarting backend only..."
	$(DEV_COMPOSE) restart backend
	@echo "Backend restarted!"

restart-frontend: rf
restart-backend: rb

logs:
	@echo "Showing logs (Ctrl+C to exit)..."
	$(COMPOSE) logs -f

rebuild:
	@echo "Force rebuilding all images (no cache)..."
	$(COMPOSE) build --no-cache
	@echo "Rebuild complete! Run 'make dev' or 'make prod' to start"

rebuild-dev:
	@echo "Rebuilding dev containers with cache..."
	$(DEV_COMPOSE) build
	@make stop
	@make dev

rebuild-frontend:
	@echo "Rebuilding frontend only..."
	$(DEV_COMPOSE) build frontend
	$(DEV_COMPOSE) up -d --force-recreate --no-deps frontend
	@echo "Frontend rebuilt!"

rebuild-backend:
	@echo "Rebuilding backend only..."
	$(DEV_COMPOSE) build backend
	$(DEV_COMPOSE) up -d --force-recreate --no-deps backend
	@echo "Backend rebuilt!"

status:
	@echo "Service Status:"
	@echo ""
	$(COMPOSE) ps
	@echo ""
	@echo "Health Checks:"
	@$(COMPOSE) exec -T backend curl -s http://localhost:8060/health 2>/dev/null && echo "  Backend container: Healthy" || echo "  Backend container: Not responding"
	@$(COMPOSE) exec -T frontend curl -s http://localhost:80/ 2>/dev/null >/dev/null && echo "  Frontend: Healthy (nginx port 80 -> host)" || echo "  Frontend: Not responding"

clean:
	@echo "Removing this project's containers and locally built images..."
	$(COMPOSE) down --remove-orphans --rmi local
	@echo "Project cleanup complete"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SERVER DEPLOYMENT COMMANDS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

deploy: ensure-env
	@echo "Deploying (frontend + backend)..."
	@BUILDKIT_PROGRESS=quiet $(COMPOSE) up -d --build --remove-orphans
	@echo ""
	@echo "Deployment complete!"
	@echo "  Frontend: http://localhost:$(FRONTEND_HOST_PORT)"
	@echo "  Backend:  http://localhost:$(BACKEND_HOST_PORT)"

deploy-clean:
	@echo "Clearing Docker build cache..."
	docker builder prune -f
	@echo "Deploying with fresh cache..."
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d --remove-orphans
	@echo "Clean deployment complete!"

# Fast local frontend build - wipes target dir then copies dist in.
# WIPE-THEN-COPY is mandatory: hashed-immutable assets accumulate forever
# otherwise. Old bundles stay reachable on the origin (and at any CDN edge),
# so a service worker that cached an old index.html keeps loading the old
# JS even after the new build is "deployed". Empty the dir first to force
# old asset hashes to 404 cleanly.
deploy-front:
	@echo "Deploying frontend only..."
	@if [ ! -d "frontend/node_modules" ]; then \
		echo "Installing dependencies (first time only)..."; \
		cd frontend && npm ci; \
	fi
	@echo "Building frontend locally (fast!)..."
	@cd frontend && npm run build
	@CID=$$($(COMPOSE) ps -q frontend); \
		if [ -z "$$CID" ]; then echo "Frontend container not running. Run 'make prod' or 'make deploy' first."; exit 1; fi; \
		echo "Wiping old assets in $$CID..."; \
		docker exec $$CID sh -c 'rm -rf /usr/share/nginx/html/*' && \
		echo "Copying new build into $$CID..." && \
		docker cp frontend/dist/. $$CID:/usr/share/nginx/html/ && \
		echo "Reloading nginx..." && \
		(docker exec $$CID nginx -s reload 2>/dev/null || true)
	@echo "Frontend deployed!"

deploy-back:
	@echo "Deploying backend only..."
	$(COMPOSE) build backend
	$(COMPOSE) up -d --no-deps backend
	@echo "Backend deployed!"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GIT HELPER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

commit:
	@echo "Staging all changes..."
	@git add -A
	@python3 scripts/security/pii_scan.py --staged
	@echo ""
	@echo "Enter commit message:"
	@bash -c 'read -p "> " msg; if [ -z "$$msg" ]; then echo "Commit cancelled (empty message)"; exit 1; fi; git commit -m "$$msg"'
	@echo ""
	@echo "Committed! To push: git push"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AUTOMATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setup-cron:
	@echo "Setting up automated cron job..."
	@echo ""
	@echo "Add this line to your crontab (run: crontab -e):"
	@echo ""
	@echo "  30 8 * * * $(shell pwd)/scripts/daily_update.sh >> $(shell pwd)/logs/cron.log 2>&1"
	@echo ""
	@echo "Create logs directory first: mkdir -p $(shell pwd)/logs"

cron-log:
	@echo "Cron Log"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ -f logs/cron.log ]; then \
		tail -50 logs/cron.log; \
	else \
		echo "Log file not found: logs/cron.log"; \
		echo "Run 'make setup-cron' for setup instructions."; \
	fi
