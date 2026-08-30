#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_EXAMPLE="$REPO_ROOT/config/env.example"

env_get() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print $2; exit }' "$ENV_EXAMPLE"
}

assert_contains() {
  local file="$1" expected="$2"
  if ! grep -F "$expected" "$file" >/dev/null; then
    echo "$file must contain: $expected" >&2
    exit 1
  fi
}

backend_port="$(env_get BACKEND_PORT)"
frontend_port="$(env_get FRONTEND_PORT)"
dev_frontend_port="$(env_get DEV_FRONTEND_PORT)"

for port in "$backend_port" "$frontend_port" "$dev_frontend_port"; do
  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    echo "config/env.example must define numeric runtime ports" >&2
    exit 1
  fi
done

rendered="$(docker compose --env-file "$ENV_EXAMPLE" \
  -f "$REPO_ROOT/docker-compose.yml" -f "$REPO_ROOT/docker-compose.dev.yml" config)"

printf '%s\n' "$rendered" | grep -F "published: \"$backend_port\"" >/dev/null
printf '%s\n' "$rendered" | grep -F "published: \"$dev_frontend_port\"" >/dev/null
printf '%s\n' "$rendered" | grep -F "VITE_API_URL: http://localhost:$backend_port" >/dev/null
assert_contains "$REPO_ROOT/README.md" "http://localhost:$backend_port/api/docs"
assert_contains "$REPO_ROOT/docs/ARCHITECTURE.md" "http://localhost:$backend_port"
assert_contains "$REPO_ROOT/docs/RENDER.md" "port \`$backend_port\`"
assert_contains "$REPO_ROOT/AGENTS.md" "http://localhost:$backend_port"
assert_contains "$REPO_ROOT/backend/tests/test_architecture.py" "http://localhost:$backend_port"
assert_contains "$REPO_ROOT/scripts/daily_update.sh" "http://localhost:$backend_port"

if rg -F '${BACKEND_PORT:-' "$REPO_ROOT/docker-compose.yml" "$REPO_ROOT/docker-compose.dev.yml" >/dev/null; then
  echo "Compose must take BACKEND_PORT from config/.env without a duplicate fallback" >&2
  exit 1
fi

if rg -n 'localhost:[0-9]+' "$REPO_ROOT/frontend/src/utils/api.ts" >/dev/null; then
  echo "frontend/src/utils/api.ts must not carry a duplicate local port" >&2
  exit 1
fi

echo "Runtime configuration contract passed"
