#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${PROJECT_ROOT}/bruno-api-tests"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
OUTPUT_FILE="${PROJECT_ROOT}/bruno-api-tests-${TIMESTAMP}.zip"

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Source directory not found: ${SOURCE_DIR}" >&2
  exit 1
fi

cd "${PROJECT_ROOT}"
zip -r "${OUTPUT_FILE}" "bruno-api-tests" >/dev/null

echo "Created archive: ${OUTPUT_FILE}"
