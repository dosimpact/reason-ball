# Workspace Monorepo Orchestration Plan

## Overview

Unify `1-infra-graph-rag` through `4-10-k-chat-bot-next` under one repository control surface using:

- `pnpm workspace`
- `turbo`
- `uv` for Python virtual environment and dependency sync

The goal is to make infra, backend, parser, and chatbot run as one stack with consistent top-level commands.

## Goals

- Run infrastructure with `pnpm run infra:up` and `pnpm run infra:down`
- Run the whole stack with `pnpm run dev`
- Build the whole stack with `pnpm run build`
- Start the production-like stack with `pnpm run start`
- Provide `pnpm run test:unit` and `pnpm run test:e2e`
- Replace ad-hoc Python venv handling in `3-10-k-parser` with `uv`

## Scope

### In Scope

- Root workspace manifests
- Turbo task graph
- Package manifests for infra and parser
- Root orchestration scripts for full-stack E2E
- README and PDCA documentation updates

### Out of Scope

- Splitting shared libraries into separate packages
- Dockerizing every service runtime
- CI pipeline wiring

## Success Criteria

1. Root `pnpm install` succeeds and recognizes the workspace packages.
2. Root `pnpm run infra:up` and `pnpm run infra:down` control the infra compose stack.
3. Root `pnpm run dev` starts collector, parser, and chatbot together.
4. Root `pnpm run build` and `pnpm run test:unit` execute per-package tasks through Turbo.
5. Root `pnpm run test:e2e` boots the full stack, runs Playwright, and cleans Chromium/Playwright processes.

## Risks And Mitigations

- `uv` may not be installed on the host.
  - Mitigation: bootstrap it from `python3 -m pip install --user uv`.
- The parser is not currently packaged as a Python project.
  - Mitigation: add a minimal `pyproject.toml` with `src/` package discovery.
- Existing per-project lockfiles may become stale.
  - Mitigation: make the root workspace lockfile the source of truth and document the new workflow.
