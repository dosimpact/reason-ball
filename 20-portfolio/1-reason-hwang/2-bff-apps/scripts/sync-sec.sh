#!/usr/bin/env bash
# Sync company information, then collect 20 years of filings for companies with tickers.
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  cat <<'HELP'
Usage: pnpm sec:sync
       bash scripts/sync-sec.sh

Builds the BFF and runs, in order:
  1. Company synchronization
  2. Filing metadata for the last 20 years (companies with nonblank DB tickers)
  3. Filing document downloads

Uses the BFF .env database and SEC settings. No running API server is required.
Progress is printed to the terminal and saved under DATA_DIR/runs/*.sse.
Existing downloaded documents are preserved. Failed documents are retried.
Press Ctrl-C to stop. Run again to resume collection from stored filing states.
HELP
  exit 0
fi
if [[ $# -ne 0 ]]; then
  echo 'Unexpected arguments. Use --help for usage.' >&2
  exit 2
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
pnpm build
exec node scripts/run-sec-backfill.cjs 20
