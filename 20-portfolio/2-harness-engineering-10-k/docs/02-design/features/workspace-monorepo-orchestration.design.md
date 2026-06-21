# Workspace Monorepo Orchestration Design

## Architecture

The workspace root becomes the control plane.

- Root `package.json`
  - owns top-level scripts
  - installs `turbo`
- `pnpm-workspace.yaml`
  - includes `1-infra-graph-rag`, `2-10-k-collector`, `3-10-k-parser`, `4-10-k-chat-bot-next`
- `turbo.json`
  - defines `build`, `dev`, `start`, `test:unit`, `clean`
- Per-project package manifests
  - infra: docker compose wrapper
  - collector: TypeScript API service
  - parser: `uv`-backed Python service
  - chatbot: Next.js UI and Playwright tests

## Service Contract

### Ports

- collector: `3305`
- parser: `3406`
- chatbot: `3003`
- postgres: workspace host port `55432` via compose override
- neo4j bolt: `7687`

### Root Commands

- `pnpm run infra:up`
  - delegates to `1-infra-graph-rag/docker-compose.yml`
- `pnpm run infra:down`
  - tears down the compose stack
- `pnpm run dev`
  - ensures infra is up
  - starts collector, parser, chatbot in parallel
- `pnpm run build`
  - builds collector and chatbot, compiles parser sources
- `pnpm run start`
  - ensures infra is up
  - starts production-like service processes
- `pnpm run test:unit`
  - collector type-check
  - parser bytecode compile validation
  - chatbot TypeScript validation
- `pnpm run test:e2e`
  - brings infra up
  - launches collector/parser/chatbot dev servers
  - waits for health endpoints
  - runs Playwright investment assistant E2E
  - terminates spawned services and Chromium/Playwright leftovers

## Python Runtime Design

`3-10-k-parser` adopts `uv` with a local `pyproject.toml`.

- `uv sync --project .`
  - creates `.venv`
  - installs parser dependencies
- `uv run --project . python -m parser.server`
  - starts the API without manual `source .venv/bin/activate`

## Validation Plan

1. `pnpm install`
2. `pnpm run infra:up`
3. `pnpm run build`
4. `pnpm run test:unit`
5. `pnpm run test:e2e`
6. `pnpm run infra:down`
