#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/config/.env"
COMPOSE_FILES=(-f "$REPO_ROOT/docker-compose.yml")

env_get() {
  local key="$1"
  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "")
      sub(/^[[:space:]]*"/, ""); sub(/"[[:space:]]*$/, "")
      sub(/^[[:space:]]*'\''/, ""); sub(/'\''[[:space:]]*$/, "")
      print
      exit
    }
  ' "$ENV_FILE"
}

assert_environment_value() {
  local rendered="$1" key="$2" expected="$3"
  local actual
  actual="$(printf '%s\n' "$rendered" | awk -F': ' -v key="$key" '
    $1 ~ "^[[:space:]]*" key "$" {
      sub(/^[^:]*:[[:space:]]*/, "")
      gsub(/^"|"$/, "")
      print
      exit
    }
  ')"
  if [ "$actual" != "$expected" ]; then
    echo "Compose did not preserve $key from config/.env" >&2
    exit 1
  fi
}

rendered="$(docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" config)"

for key in APP_API_KEY CORS_ORIGINS TRUSTED_HOSTS LOG_LEVEL; do
  assert_environment_value "$rendered" "$key" "$(env_get "$key")"
done

if printf '%s\n' "$rendered" | grep -q 'container_name:'; then
  echo "Compose must not declare fixed container_name values" >&2
  exit 1
fi

if printf '%s\n' "$rendered" | grep -q 'API_PREFIX:'; then
  echo "API_PREFIX must remain the fixed /api invariant" >&2
  exit 1
fi

for project_name in clone-one clone-two; do
  project_rendered="$(docker compose --env-file "$ENV_FILE" -p "$project_name" "${COMPOSE_FILES[@]}" config)"
  printf '%s\n' "$project_rendered" | grep -F "name: $project_name" >/dev/null
done

docker compose --env-file "$ENV_FILE" \
  -f "$REPO_ROOT/docker-compose.yml" -f "$REPO_ROOT/docker-compose.dev.yml" \
  config --quiet

echo "Compose configuration tests passed"
