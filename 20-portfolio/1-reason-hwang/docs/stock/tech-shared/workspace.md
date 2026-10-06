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

## WORKSPACE-BOUNDARY-001: Independent root

The authoritative root for this project is `20-portfolio/1-reason-hwang/package.json`, together with the adjacent workspace, lockfile, and Turbo configuration. The parent workspace excludes `!20-portfolio/1-reason-hwang/**` and its lockfile contains none of this project's importers. Parent `*:reason-hwang` scripts delegate with `pnpm -C 20-portfolio/1-reason-hwang`; they do not run the parent Turbo graph.

Run `pnpm install --frozen-lockfile` here separately from the parent installation. From the repository root, use `pnpm -C 20-portfolio/1-reason-hwang install --frozen-lockfile`. Generic parent install/build/test commands do not manage this project.

Decision and validation: [2026-10-02 boundary reconciliation](../../flow/2026-10-02-independent-workspace-boundary.md).

## Root commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install JavaScript workspace dependencies |
| `pnpm dev` | Stop verified existing app listeners, then run five application dev tasks through Turbo |
| `pnpm test:dev` | Validate scoped development-port cleanup and collision handling |
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

## DEV-START-001: App restart before development startup

`pnpm dev` runs `scripts/dev.mjs`. On macOS/Linux with `lsof`, the launcher checks
2800 (host), 2801 (BFF), 2802 (template), 2803 (todo), and 8000 (FastAPI) before
starting Turbo. All occupied ports must belong to the matching package directory
in this exact checkout and a recognized Node/Python development runtime. Unknown
owners and other checkouts cause an explicit error before any termination.

Verified listeners and their package-local runtime supervisors receive SIGTERM;
shells and the current invocation's ancestors are excluded. Identity is checked
again before signaling, and startup waits up to ten seconds for the captured
processes and ports to clear. There is no automatic SIGKILL. Permission denial,
identity changes, or a watcher that keeps a port occupied stop startup with a
message instead of launching duplicate servers. Run this command in the user's
terminal when an agent sandbox cannot signal existing processes or open ports.

Turbo starts only the five application dev tasks; infrastructure packages are
explicitly excluded. Docker databases, observability services, and the OAuth
proxy remain running. Nondefault ports such as 2820/18083 are outside this
restart scope. Application port changes must update APP_PORTS in
`scripts/dev-ports.mjs` together with the package configuration.

Validation and scope: [restart flow](../../flow/2026-10-02-dev-port-restart.md).

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
- Shared current architecture and workspace policy: `docs/stock/tech-shared/`.
- Package-specific technical detail: `docs/stock/tech-shared/{1-fe-host,2-bff-apps,3-langgraph-fast,infra}/`; see [DOC-SCOPE-002](INDEX.md#doc-scope-002-공용과-구체의-두-가지-범위).
- Domain current state: `docs/stock/<domain-feature-name>/`.
- Change history: `docs/flow/`.

## DOC-DISCOVERY-001: Documentation navigation

`AGENTS.md` directs agents to [Documentation Map](../../INDEX.md), which owns the detailed reading order and document selection rules. Discover task-relevant stock documents first, then related flow records and supporting references. Shared design principles are required reading for code design, implementation, and review through that map. Read relevant history without loading all stock and flow documents by default.

Stock defines the accepted current state; flow preserves dated context and validation evidence. Material changes require an append-only flow record and synchronization of affected stock before completion. Keep detailed navigation links in the map so new shared principles can be discovered without adding a direct reference for each one to `AGENTS.md`.

`AGENTS.md` retains only workspace scope, the map entry point, change safety, execution/validation basics, and completion requirements. Package inventories, endpoints, architecture details, and code conventions belong in the mapped stock documents.

## CODE-EXPLORE-001: Code exploration tooling

Codebase Memory MCP 0.11.0 is installed locally and registered as `reason-hwang-codebase-memory` in user-scoped Codex configuration. Follow the [root MCP installation guide](../../../README.md#5-codebase-memory-mcp-설치-및-코드-탐색) for installation, scoped registration, and indexing. A direct stdio MCP client verified initialization, tool discovery, and project listing; a new Codex session is required to refresh its tool catalog.

The seven child packages have separate named indexes; the orchestration root is not separately indexed. BFF's index also includes its nested remotes. Each indexed root owns a `.cbmignore` excluding environment files, credential configuration and generated data. Nested `.cbmignore` files are not inherited, so changing an indexing root requires reviewing its own exclusions. Use `persistence=false` to retain indexes in the local cache without repository snapshots. `.codebase-memory/` is also Git-ignored as a safeguard.

Index this workspace only, not the parent repository. Use architecture, symbol, and call-path queries to locate relevant code, then verify findings against current source with file reads and `rg`. An empty result is not proof that an implementation does not exist. Generated indexes and artifacts are local derived data, separate from application PostgreSQL persistence; exclude them from Git. Code graphs replace neither canonical stock documents nor execution-based validation.
