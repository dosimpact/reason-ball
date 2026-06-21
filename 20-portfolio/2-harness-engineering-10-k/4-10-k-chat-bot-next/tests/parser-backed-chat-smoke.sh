#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3003}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/10k-parser-chat-smoke.XXXXXX")"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

COOKIE_FILE="${COOKIE_FILE:-${TMP_DIR}/cookie.txt}"
OUT_FILE="${OUT_FILE:-${TMP_DIR}/stream.txt}"
PAYLOAD_FILE="${PAYLOAD_FILE:-${TMP_DIR}/payload.json}"
RESUME_OUT="${RESUME_OUT:-${TMP_DIR}/resume.txt}"

rm -f "$COOKIE_FILE" "$OUT_FILE" "$PAYLOAD_FILE" "$RESUME_OUT"

curl -sS -L -c "$COOKIE_FILE" -b "$COOKIE_FILE" "$BASE_URL/api/auth/guest?redirectUrl=%2F" >/dev/null

chat_id=$(uuidgen | tr 'A-Z' 'a-z')
msg_id=$(uuidgen | tr 'A-Z' 'a-z')

cat > "$PAYLOAD_FILE" <<JSON
{
  "id": "$chat_id",
  "message": {
    "id": "$msg_id",
    "role": "user",
    "parts": [
      { "type": "text", "text": "Sample Technology risks 알려줘" }
    ]
  },
  "selectedChatModel": "google/gemini-2.5-flash-lite",
  "selectedVisibilityType": "private"
}
JSON

curl -sS -N -b "$COOKIE_FILE" -H 'content-type: application/json' -X POST "$BASE_URL/api/chat" --data @"$PAYLOAD_FILE" > "$OUT_FILE"

if rg -n "Parser backend chat runtime request failed|Oops, an error occurred" "$OUT_FILE" >/dev/null; then
  echo "FAIL: chat stream contains backend error"
  exit 1
fi

if ! rg -n 'text-delta|data-selected-filing|data-retrieval-debug' "$OUT_FILE" >/dev/null; then
  echo "FAIL: parser-backed chat stream did not emit expected adapted chunks"
  exit 1
fi

curl -sS -N -b "$COOKIE_FILE" "$BASE_URL/api/chat/$chat_id/stream" > "$RESUME_OUT"

if ! rg -n 'text-delta' "$RESUME_OUT" >/dev/null; then
  echo "FAIL: parser-backed resume stream did not emit text delta"
  exit 1
fi

echo "PASS: parser-backed chat and resume stream produced expected SSE output"
