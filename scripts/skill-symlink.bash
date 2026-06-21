#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SKILL_SOURCES=(".agentic-playbook-rc" ".agentic-playbook", '.agents')
TARGET_DIR="$REPO_ROOT/.codex/skills"

mkdir -p "$TARGET_DIR"

for source_dir in "${SKILL_SOURCES[@]}"; do
  source_path="$REPO_ROOT/$source_dir"
  [ -d "$source_path" ] || continue

  for skill in "$source_path"/*; do
    [ -d "$skill" ] || continue

    target="$TARGET_DIR/$(basename "$skill")"
    relative_source="../../$source_dir/$(basename "$skill")"

    if [ -L "$target" ]; then
      rm "$target"
    fi

    if [ -e "$target" ]; then
      echo "skip existing non-symlink: $target"
      continue
    fi

    ln -s "$relative_source" "$target"
  done
done
