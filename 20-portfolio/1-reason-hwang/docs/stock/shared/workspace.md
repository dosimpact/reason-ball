# Workspace Design

## Status

`1-reason-hwang` is an independent pnpm workspace and Turborepo root inside the larger `reason-ball` repository. Its dependencies, lockfile, task graph, documentation, and validation commands are owned from this directory.

## Package scope

The root package and seven child packages are registered by `pnpm-workspace.yaml`:

| Path | Package | Runtime |
| --- | --- | --- |
| `1-fe-host` | `reason-hwang-fe-host` | Next.js/TypeScript |
| `2-bff-apps` | `@reason-hwang/bff-apps` | NestJS/TypeScript |
| `2-bff-apps/remotes/template` | `@reason-hwang/remote-template` | Vite React/TypeScript |
| `2-bff-apps/remotes/todo` | `@reason-hwang/remote-todo` | Vite React/TypeScript |
| `3-langgraph-fast` | `reason-hwang-langgraph-fast` | FastAPI/LangGraph/Python |
| `infra/1-infra-graph-rag` | `@10k/infra` | Docker Compose |
| `infra/2-codex-oauth-proxy` | `@reason-hwang/codex-oauth-proxy` | Python/Docker Compose |

Generated directories, local agent configuration, virtual environments, build output, and caches are excluded from workspace discovery. The parent repository workspace explicitly excludes this independent workspace.

## Root commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install JavaScript workspace dependencies |
| `pnpm dev` | Run available persistent development tasks through Turbo |
| `pnpm build` | Build packages that define a build task |
| `pnpm start` | Start the production host and BFF |
| `pnpm test` | Run package tests after dependency builds |
| `pnpm test:e2e` | Run the host Playwright suite |
| `pnpm lint` | Run package lint tasks |
| `pnpm typecheck` | Run package type checks |
| `pnpm clean` | Run package cleanup tasks |
| `pnpm infra:up` | Start infrastructure packages |
| `pnpm infra:ps` | Inspect infrastructure health/status |
| `pnpm infra:down` | Stop infrastructure packages without deleting persisted host data |

Python packages use `uv`. Run `uv sync` in `3-langgraph-fast` or `infra/2-codex-oauth-proxy` when installing their Python dependencies.

## Default endpoints

| Service | Endpoint |
| --- | --- |
| Frontend host | `http://127.0.0.1:2800` |
| BFF and remote provider | `http://localhost:2801` |
| template remote dev server | `http://localhost:2802` |
| todo remote dev server | `http://localhost:2803` |
| FastAPI/LangGraph | `http://127.0.0.1:8000` |
| LangGraph development runtime | `http://127.0.0.1:2024` |
| OAuth proxy | `http://127.0.0.1:18741` |
| Neo4j Browser/Bolt | `http://localhost:7474`, `localhost:7687` |
| PostgreSQL | `localhost:55432` by default |
| Loki | `http://localhost:3100` |
| Prometheus | `http://localhost:9090` |
| cAdvisor | `http://localhost:8080` |
| Grafana | `http://localhost:3001` |

Infrastructure ports are configurable through `infra/1-infra-graph-rag/.env`; the table records defaults from the current Compose and example environment files.

## Configuration ownership

- Root orchestration: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `pnpm-lock.yaml`.
- Application-specific dependencies and scripts: each package's manifest.
- Python dependencies: each Python project's `pyproject.toml` and `uv.lock`.
- Secrets and machine-local values: untracked `.env` and OAuth token files.
- Shared current architecture and workspace policy: `docs/stock/shared/`.
- Domain current state: `docs/stock/<domain-feature-name>/`.
- Change history: `docs/flow/`.

## DOC-DISCOVERY-001: Documentation navigation

`AGENTS.md` directs agents to [Documentation Map](../../README.md), which owns the detailed reading order and document selection rules. Discover task-relevant stock documents first, then related flow records and supporting references. Shared design principles are required reading for code design, implementation, and review through that map. Read relevant history without loading all stock and flow documents by default.

Stock defines the accepted current state; flow preserves dated context and validation evidence. Material changes require an append-only flow record and synchronization of affected stock before completion. Keep detailed navigation links in the map so new shared principles can be discovered without adding a direct reference for each one to `AGENTS.md`.

`AGENTS.md` retains only workspace scope, the map entry point, change safety, execution/validation basics, and completion requirements. Package inventories, endpoints, architecture details, and code conventions belong in the mapped stock documents.
