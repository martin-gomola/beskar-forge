#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCTOR="$REPO_ROOT/scripts/doctor.sh"
EXAMPLE="$REPO_ROOT/config/env.example"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

make_env() {
  local destination="$1"
  cp "$EXAMPLE" "$destination"
  sed -i.bak \
    -e 's/^DEV_FRONTEND_PORT=.*/DEV_FRONTEND_PORT=49020/' \
    -e 's/^BACKEND_PORT=.*/BACKEND_PORT=49021/' \
    -e 's/^FRONTEND_PORT=.*/FRONTEND_PORT=49022/' \
    "$destination"
  rm -f "$destination.bak"
}

assert_fails_with() {
  local env_file="$1" expected="$2" output="$TEMP_DIR/output.txt"
  if BESKAR_ENV_FILE="$env_file" bash "$DOCTOR" >"$output" 2>&1; then
    echo "Expected doctor to fail: $expected" >&2
    exit 1
  fi
  grep -F "$expected" "$output" >/dev/null
}

valid_env="$TEMP_DIR/valid.env"
make_env "$valid_env"
BESKAR_ENV_FILE="$valid_env" bash "$DOCTOR" >/dev/null

invalid_log="$TEMP_DIR/invalid-log.env"
make_env "$invalid_log"
sed -i.bak 's/^LOG_LEVEL=.*/LOG_LEVEL=verbose/' "$invalid_log"
rm -f "$invalid_log.bak"
assert_fails_with "$invalid_log" "LOG_LEVEL must be one of"

invalid_port="$TEMP_DIR/invalid-port.env"
make_env "$invalid_port"
sed -i.bak 's/^BACKEND_PORT=.*/BACKEND_PORT=not-a-port/' "$invalid_port"
rm -f "$invalid_port.bak"
assert_fails_with "$invalid_port" "backend port must be numeric"

duplicate_ports="$TEMP_DIR/duplicate-ports.env"
make_env "$duplicate_ports"
sed -i.bak 's/^FRONTEND_PORT=.*/FRONTEND_PORT=49021/' "$duplicate_ports"
rm -f "$duplicate_ports.bak"
assert_fails_with "$duplicate_ports" "must be different"

missing_key="$TEMP_DIR/missing-key.env"
make_env "$missing_key"
sed -i.bak '/^LOG_LEVEL=/d' "$missing_key"
rm -f "$missing_key.bak"
assert_fails_with "$missing_key" "config/.env is missing key: LOG_LEVEL"

echo "Doctor configuration tests passed"
