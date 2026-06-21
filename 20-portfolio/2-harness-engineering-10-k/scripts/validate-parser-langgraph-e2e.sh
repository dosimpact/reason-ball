#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARSER_DIR="${ROOT_DIR}/3-10-k-parser/bruno-api-tests"
NEXT_DIR="${ROOT_DIR}/4-10-k-chat-bot-next"
PARSER_BASE_URL="${PARSER_BASE_URL:-http://127.0.0.1:3406}"
NEXT_BASE_URL="${NEXT_BASE_URL:-http://127.0.0.1:3003}"

if ! command -v bru >/dev/null 2>&1; then
  echo "bru CLI is required. Install @usebruno/cli first."
  exit 1
fi

cd "${PARSER_DIR}"

echo "[1/3] Bruno setup flow"
bru run setup --env local --env-var baseUrl="${PARSER_BASE_URL}"

echo "[2/3] Bruno langgraph flow"
bru run langgraph --env local --env-var baseUrl="${PARSER_BASE_URL}"

if [[ "${SKIP_NEXT_SMOKE:-0}" == "1" ]]; then
  echo "[3/3] Skipping Next smoke because SKIP_NEXT_SMOKE=1"
  exit 0
fi

echo "[3/3] Next parser-backed chat smoke"
BASE_URL="${NEXT_BASE_URL}" "${NEXT_DIR}/tests/parser-backed-chat-smoke.sh"
