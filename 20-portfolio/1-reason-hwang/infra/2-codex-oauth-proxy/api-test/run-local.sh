#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
report_dir="$root_dir/api-test/reports"
timestamp="$(date +%Y-%m-%d-%H%M%S)"
compose_log="$report_dir/$timestamp-compose.log"
test_log="$report_dir/$timestamp.log"
started_by_test=false

mkdir -p "$report_dir"
cd "$root_dir"

cleanup() {
  if [[ "$started_by_test" == true ]]; then
    "${compose_cmd[@]}" down >>"$compose_log" 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "[preflight 1/2] Checking ChatGPT OAuth credentials"
if [[ ! -f .config/chatgpt_auth.json ]]; then
  echo "Missing .config/chatgpt_auth.json" >&2
  echo "Run: pnpm oauth" >&2
  exit 1
fi

uv run python - <<'PY'
from core.token_manager import TokenManager

TokenManager().validate_or_fail()
print("OAuth credentials are present and contain a refresh token.")
PY

echo "[preflight 2/2] Checking Docker Compose"
docker info >/dev/null
if docker compose version >/dev/null 2>&1; then
  compose_cmd=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose_cmd=(docker-compose)
else
  echo "Docker Compose is not installed." >&2
  exit 1
fi
"${compose_cmd[@]}" version >/dev/null
"${compose_cmd[@]}" config --quiet

existing_container="$("${compose_cmd[@]}" ps -q codex-oauth-proxy)"
if [[ -n "$existing_container" ]] && [[ "$(docker inspect -f '{{.State.Running}}' "$existing_container")" == true ]]; then
  echo "Rebuilding the existing Docker Compose service with current sources."
  "${compose_cmd[@]}" up -d --build >"$compose_log" 2>&1
else
  echo "Building and starting Docker Compose service."
  "${compose_cmd[@]}" up -d --build >"$compose_log" 2>&1
  started_by_test=true
fi

published_address="$("${compose_cmd[@]}" port codex-oauth-proxy 18741)"
proxy_port="${published_address##*:}"
base_url="http://127.0.0.1:$proxy_port"

for _ in {1..60}; do
  if curl --fail --silent "$base_url/health" >/dev/null; then
    break
  fi
  sleep 0.5
done

health="$(curl --fail --silent "$base_url/health")" || {
  echo "Proxy did not become healthy. See $compose_log" >&2
  "${compose_cmd[@]}" logs codex-oauth-proxy >&2
  exit 1
}

if [[ "$(printf '%s' "$health" | uv run python -c 'import json,sys; print(str(json.load(sys.stdin).get("token_valid", False)).lower())')" != true ]]; then
  echo "Proxy is running, but its OAuth token is not valid. Run: pnpm oauth" >&2
  exit 1
fi

echo "[run] Executing endpoint tests"
cd "$root_dir/api-test"

bru_cmd="bru"
if ! command -v bru >/dev/null 2>&1; then
  if [[ -x "$root_dir/../../node_modules/.bin/bru" ]]; then
    bru_cmd="$root_dir/../../node_modules/.bin/bru"
  elif command -v npx >/dev/null 2>&1; then
    bru_cmd="npx -y @usebruno/cli"
  fi
fi

$bru_cmd run --env local --env-var "baseUrl=$base_url" 2>&1 | tee "$test_log"

if grep -Eq 'Skipped\)|Skipping invalid file|Tests[[:space:]]+│[[:space:]]+0/0' "$test_log"; then
  echo "Bruno skipped or did not execute the endpoint test." >&2
  exit 1
fi
