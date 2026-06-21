#!/usr/bin/env sh
set -eu

NEXT_ENV_FILE="${NEXT_ENV_FILE:-next-env.d.ts}"
SNAPSHOT_FILE="$(mktemp "${TMPDIR:-/tmp}/10k-next-env.XXXXXX")"
HAD_NEXT_ENV=0

if [ -f "$NEXT_ENV_FILE" ]; then
  cp "$NEXT_ENV_FILE" "$SNAPSHOT_FILE"
  HAD_NEXT_ENV=1
fi

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$HAD_NEXT_ENV" = "1" ]; then
    if [ -f "$SNAPSHOT_FILE" ]; then
      cp "$SNAPSHOT_FILE" "$NEXT_ENV_FILE"
    fi
  else
    rm -f "$NEXT_ENV_FILE"
  fi
  rm -f "$SNAPSHOT_FILE"
  exit "$status"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

"$@"
