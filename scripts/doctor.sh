#!/usr/bin/env bash
# doctor.sh - verify the local dev/deploy environment is sane.
#
# Run via `make doctor`. Exits 0 if everything looks good, 1 if any check
# fails. Designed to catch the configuration mistakes that have actually
# bitten this stack:
#   - missing config/.env
#   - missing or unknown keys compared with config/env.example
#   - APP_API_KEY blank for non-local deployments
#   - CORS_ORIGINS missing the public host (causes WebSocket 403s)
#   - TRUSTED_HOSTS containing a scheme (FastAPI rejects)
#   - invalid LOG_LEVEL or host port values
#   - unsupported Docker Compose version
#   - Docker daemon unreachable
#   - declared host ports already bound by another container/process
#
# Designed to be safe to run with no arguments, no network access, no writes.

set -u  # error on undefined vars; do NOT set -e (we want to keep checking)

# ---------- output helpers ----------
if [ -t 1 ]; then
  C_RED='\033[0;31m'; C_YEL='\033[0;33m'; C_GRN='\033[0;32m'; C_DIM='\033[2m'; C_OFF='\033[0m'
else
  C_RED=''; C_YEL=''; C_GRN=''; C_DIM=''; C_OFF=''
fi

ERRORS=0
WARNINGS=0

err()  { printf "${C_RED}FAIL${C_OFF}    %s\n" "$1"; ERRORS=$((ERRORS+1)); }
warn() { printf "${C_YEL}WARN${C_OFF}    %s\n" "$1"; WARNINGS=$((WARNINGS+1)); }
ok()   { printf "${C_GRN}OK${C_OFF}      %s\n" "$1"; }
info() { printf "${C_DIM}info${C_OFF}    %s\n" "$1"; }
section() { printf "\n${C_DIM}--- %s ---${C_OFF}\n" "$1"; }

# Resolve repo root: scripts/ is always one level under the repo root.
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${BESKAR_ENV_FILE:-$REPO_ROOT/config/.env}"
ENV_EXAMPLE="$REPO_ROOT/config/env.example"

# ---------- env file ----------
section "config/.env"
if [ ! -f "$ENV_FILE" ]; then
  err "config/.env missing. Run: cp config/env.example config/.env"
  if [ -f "$ENV_EXAMPLE" ]; then
    info "config/env.example exists; copy and fill in values."
  fi
else
  ok "config/.env present"
fi

# Compare names only. Never print values from the local env file.
if [ -f "$ENV_FILE" ] && [ -f "$ENV_EXAMPLE" ]; then
  while IFS= read -r key; do
    if ! awk -F= -v key="$key" '$1 == key { found=1 } END { exit !found }' "$ENV_FILE"; then
      err "config/.env is missing key: $key"
    fi
  done < <(awk -F= '/^[A-Z][A-Z0-9_]*=/ { print $1 }' "$ENV_EXAMPLE" | sort -u)

  while IFS= read -r key; do
    if [ "$key" = "COMPOSE_PROJECT_NAME" ]; then
      continue
    fi
    if ! awk -F= -v key="$key" '$1 == key { found=1 } END { exit !found }' "$ENV_EXAMPLE"; then
      warn "config/.env has unknown key: $key"
    fi
  done < <(awk -F= '/^[A-Z][A-Z0-9_]*=/ { print $1 }' "$ENV_FILE" | sort -u)
fi

# read a key from .env without sourcing (sourcing is unsafe for arbitrary content)
env_get() {
  [ -f "$ENV_FILE" ] || { echo ""; return; }
  awk -F= -v key="$1" '
    $0 ~ "^[[:space:]]*#" {next}
    $1 == key {
      sub(/^[^=]*=/, "")
      sub(/^[[:space:]]*"/, ""); sub(/"[[:space:]]*$/, "")
      sub(/^[[:space:]]*'\''/, ""); sub(/'\''[[:space:]]*$/, "")
      print
      exit
    }
  ' "$ENV_FILE"
}

# ---------- env values ----------
section "environment variables"
APP_API_KEY="$(env_get APP_API_KEY)"
CORS_ORIGINS="$(env_get CORS_ORIGINS)"
TRUSTED_HOSTS="$(env_get TRUSTED_HOSTS)"
LOG_LEVEL="$(env_get LOG_LEVEL)"
COMPOSE_PROJECT_NAME="$(env_get COMPOSE_PROJECT_NAME)"
BACKEND_PORT="$(env_get BACKEND_PORT)"
FRONTEND_PORT="$(env_get FRONTEND_PORT)"
DEV_FRONTEND_PORT="$(env_get DEV_FRONTEND_PORT)"

if [ -z "$APP_API_KEY" ]; then
  warn "APP_API_KEY is empty. OK for localhost-only; required for any public deployment."
else
  ok "APP_API_KEY set (${#APP_API_KEY} chars)"
  if [ "${#APP_API_KEY}" -lt 32 ]; then
    warn "APP_API_KEY is shorter than 32 characters. Generate one with: openssl rand -hex 32"
  fi
fi

case "$(printf '%s' "$LOG_LEVEL" | tr '[:lower:]' '[:upper:]')" in
  DEBUG|INFO|WARNING|ERROR|CRITICAL) ok "LOG_LEVEL=$LOG_LEVEL" ;;
  *) err "LOG_LEVEL must be one of: DEBUG, INFO, WARNING, ERROR, CRITICAL" ;;
esac

if [ -z "$CORS_ORIGINS" ]; then
  err "CORS_ORIGINS is empty. Browser requests will fail."
else
  ok "CORS_ORIGINS=$CORS_ORIGINS"
  # Each entry must be a full origin: scheme://host[:port], no trailing slash.
  IFS=',' read -ra _origins <<< "$CORS_ORIGINS"
  for origin in "${_origins[@]}"; do
    o="$(echo "$origin" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [ -z "$o" ] && continue
    case "$o" in
      http://*|https://*) : ;;
      *) err "CORS_ORIGINS entry '$o' is not a full origin. Must start with http:// or https://." ;;
    esac
    case "$o" in
      */) err "CORS_ORIGINS entry '$o' has a trailing slash. Strip it." ;;
    esac
  done
fi

if [ -z "$TRUSTED_HOSTS" ]; then
  warn "TRUSTED_HOSTS is empty. FastAPI's TrustedHostMiddleware will reject all requests."
else
  ok "TRUSTED_HOSTS=$TRUSTED_HOSTS"
  IFS=',' read -ra _hosts <<< "$TRUSTED_HOSTS"
  for host in "${_hosts[@]}"; do
    h="$(echo "$host" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [ -z "$h" ] && continue
    case "$h" in
      http://*|https://*) err "TRUSTED_HOSTS entry '$h' is a URL. Must be a hostname only (no scheme, no port)." ;;
      */*) err "TRUSTED_HOSTS entry '$h' contains '/'. Must be a hostname only." ;;
    esac
  done
fi

# Cross-check: every public host in CORS_ORIGINS should have its hostname in TRUSTED_HOSTS.
if [ -n "$CORS_ORIGINS" ] && [ -n "$TRUSTED_HOSTS" ]; then
  IFS=',' read -ra _origins2 <<< "$CORS_ORIGINS"
  for origin in "${_origins2[@]}"; do
    o="$(echo "$origin" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [ -z "$o" ] && continue
    # extract host part
    host="$(echo "$o" | sed -E 's#^https?://##; s#/.*$##; s#:.*$##')"
    [ -z "$host" ] && continue
    if ! echo ",$TRUSTED_HOSTS," | grep -qi ",[[:space:]]*$host[[:space:]]*,"; then
      warn "CORS origin '$o' references host '$host' but it's not in TRUSTED_HOSTS."
    fi
  done
fi

# ---------- docker ----------
section "docker"
if ! command -v docker >/dev/null 2>&1; then
  err "docker CLI not found on PATH."
else
  ok "docker CLI present ($(docker --version 2>/dev/null | head -1))"
  if ! docker info >/dev/null 2>&1; then
    err "docker daemon not reachable. Is Docker Desktop / OrbStack running?"
  else
    ok "docker daemon reachable"
  fi
fi

version_at_least() {
  local actual="$1" required_major="$2" required_minor="$3" required_patch="$4"
  local major minor patch
  actual="${actual#v}"
  actual="${actual%%-*}"
  IFS='.' read -r major minor patch <<< "$actual"
  major="${major:-0}"; minor="${minor:-0}"; patch="${patch:-0}"
  [ "$major" -gt "$required_major" ] ||
    { [ "$major" -eq "$required_major" ] && [ "$minor" -gt "$required_minor" ]; } ||
    { [ "$major" -eq "$required_major" ] && [ "$minor" -eq "$required_minor" ] && [ "$patch" -ge "$required_patch" ]; }
}

if docker compose version >/dev/null 2>&1; then
  COMPOSE_VERSION="$(docker compose version --short 2>/dev/null)"
  if version_at_least "$COMPOSE_VERSION" 2 24 4; then
    ok "docker compose $COMPOSE_VERSION available"
  else
    err "Docker Compose 2.24.4 or newer is required; found $COMPOSE_VERSION"
  fi
else
  err "Docker Compose v2 is required. Install Docker Desktop, OrbStack, or the Compose plugin."
fi

# ---------- ports ----------
section "host ports"
if [ -z "$COMPOSE_PROJECT_NAME" ]; then
  COMPOSE_PROJECT_NAME="$(basename "$REPO_ROOT" | tr '[:upper:]_' '[:lower:]-')"
fi

project_owns_port() {
  local port="$1"
  docker ps \
    --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
    --format '{{.Ports}}' 2>/dev/null | grep -q ":${port}->"
}

validate_port() {
  local port="$1" label="$2"
  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    err "$label port must be numeric: ${port:-<empty>}"
    return 1
  fi
  if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    err "$label port must be between 1 and 65535: $port"
    return 1
  fi
  return 0
}

check_port() {
  local port="$1" label="$2"
  [ -z "$port" ] && return 0
  # macOS + Linux compatible. lsof first, fall back to nc.
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      if project_owns_port "$port"; then
        ok "Port $port ($label) is in use by this project"
      else
        local who
        who="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1, "(pid "$2")"}')"
        warn "Port $port ($label) already bound by another process: $who"
      fi
    else
      ok "Port $port ($label) free"
    fi
  elif command -v nc >/dev/null 2>&1; then
    if nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then
      warn "Port $port ($label) already bound."
    else
      ok "Port $port ($label) free"
    fi
  else
    info "No lsof/nc available; skipping port $port check."
  fi
}

BACKEND_PORT="${BACKEND_PORT:-8062}"
FRONTEND_PORT="${FRONTEND_PORT:-8082}"
DEV_FRONTEND_PORT="${DEV_FRONTEND_PORT:-3021}"

valid_ports=true
validate_port "$BACKEND_PORT" "backend" || valid_ports=false
validate_port "$FRONTEND_PORT" "frontend" || valid_ports=false
validate_port "$DEV_FRONTEND_PORT" "vite-dev" || valid_ports=false

if [ "$valid_ports" = true ]; then
  if [ "$BACKEND_PORT" = "$FRONTEND_PORT" ] ||
     [ "$BACKEND_PORT" = "$DEV_FRONTEND_PORT" ] ||
     [ "$FRONTEND_PORT" = "$DEV_FRONTEND_PORT" ]; then
    err "BACKEND_PORT, FRONTEND_PORT, and DEV_FRONTEND_PORT must be different"
  fi

  check_port "$BACKEND_PORT" "backend"
  check_port "$FRONTEND_PORT" "frontend"
  check_port "$DEV_FRONTEND_PORT" "vite-dev"
fi

# ---------- compose model ----------
section "compose configuration"
if [ -f "$ENV_FILE" ] && docker compose version >/dev/null 2>&1; then
  if docker compose --env-file "$ENV_FILE" \
      -f "$REPO_ROOT/docker-compose.yml" config --quiet >/dev/null 2>&1 &&
     docker compose --env-file "$ENV_FILE" \
      -f "$REPO_ROOT/docker-compose.yml" -f "$REPO_ROOT/docker-compose.dev.yml" \
      config --quiet >/dev/null 2>&1; then
    ok "production and development Compose files render"
  else
    err "Compose configuration is invalid. Run: docker compose --env-file config/.env config"
  fi
fi

# ---------- summary ----------
section "summary"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  printf "${C_GRN}All checks passed.${C_OFF}\n"
  exit 0
fi
printf "Errors:   %d\n" "$ERRORS"
printf "Warnings: %d\n" "$WARNINGS"
[ "$ERRORS" -gt 0 ] && exit 1
exit 0
