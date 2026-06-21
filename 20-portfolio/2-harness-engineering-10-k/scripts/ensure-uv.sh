#!/bin/sh
set -eu

if command -v uv >/dev/null 2>&1; then
  command -v uv
  exit 0
fi

echo "uv not found. Installing with python3 -m pip --user uv..." >&2
python3 -m pip install --user uv

USER_BASE=$(python3 -m site --user-base)
UV_BIN="$USER_BASE/bin/uv"

if [ ! -x "$UV_BIN" ]; then
  echo "uv installation finished, but executable was not found at $UV_BIN" >&2
  exit 1
fi

printf '%s\n' "$UV_BIN"
