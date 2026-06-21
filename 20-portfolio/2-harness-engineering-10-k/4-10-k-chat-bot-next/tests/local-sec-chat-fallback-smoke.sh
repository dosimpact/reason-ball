#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3003}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/10k-sec-chat-smoke.XXXXXX")"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

COOKIE_FILE="${COOKIE_FILE:-${TMP_DIR}/cookie.txt}"
OUT_FILE="${OUT_FILE:-${TMP_DIR}/stream.txt}"
PAYLOAD_FILE="${PAYLOAD_FILE:-${TMP_DIR}/payload.json}"

rm -f "$COOKIE_FILE" "$OUT_FILE" "$PAYLOAD_FILE"

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
      { "type": "text", "text": "JPM 최근 10-K 목록 보여줘" }
    ]
  },
  "selectedChatModel": "google/gemini-2.5-flash-lite",
  "selectedVisibilityType": "private"
}
JSON

curl -sS -N -b "$COOKIE_FILE" -H 'content-type: application/json' -X POST "$BASE_URL/api/chat" --data @"$PAYLOAD_FILE" > "$OUT_FILE"

if rg -n "AI Gateway authentication failed|Invalid API key|Oops, an error occurred" "$OUT_FILE" >/dev/null; then
  echo "FAIL: chat stream contains gateway/auth error"
  exit 1
fi

if ! rg -n "data: \{\"type\":\"text-delta\"|data: \{\"type\":\"tool-output-available\"" "$OUT_FILE" >/dev/null; then
  echo "FAIL: no text/tool output found in chat stream"
  exit 1
fi

echo "PASS: chat stream produced response without gateway/auth error"
