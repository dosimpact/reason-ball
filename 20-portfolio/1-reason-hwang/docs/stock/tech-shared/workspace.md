# Workspace Design

## Status

`1-reason-hwang` is an independent pnpm workspace and Turborepo root inside the larger `reason-ball` repository. Its dependencies, lockfile, task graph, documentation, and validation commands are owned from this directory.

## Package scope

The root package and seven child packages are registered by `pnpm-workspace.yaml`:

| Path | Package | Runtime |
| --- | --- | --- |
| `1-fe-host` | `@reason-hwang/fe-host` | Next.js/TypeScript |
| `2-bff-apps` | `@reason-hwang/bff-apps` | NestJS/TypeScript |
| `2-bff-apps/remotes/template` | `@reason-hwang/remote-template` | Vite React/TypeScript |
| `2-bff-apps/remotes/todo` | `@reason-hwang/remote-todo` | Vite React/TypeScript |
| `3-langgraph-fast` | `@reason-hwang/langgraph-fast-api` | FastAPI/LangGraph/Python |
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
| `pnpm test:dev` | Validate scoped development-port cleanup and collision handling |
| `pnpm build` | Build packages that define a build task |
| `pnpm start` | Start the host, BFF, and LangGraph FastAPI together |
| `pnpm start:fe-host` | Start only the frontend host |
| `pnpm start:bff-apps` | Start only the BFF |
| `pnpm start:langgraph-fast-api` | Start only LangGraph FastAPI |
| `pnpm test` | Run package tests after dependency builds |
| `pnpm test:e2e` | Run the host Playwright suite |
| `pnpm lint` | Run package lint tasks |
| `pnpm typecheck` | Run package type checks |
| `pnpm clean` | Run package cleanup tasks |
| `pnpm infra:up` | Start infrastructure packages |
| `pnpm infra:ps` | Inspect infrastructure health/status |
| `pnpm infra:down` | Stop infrastructure packages without deleting persisted host data |

## DEV-START-001: App restart before development startup

The root `dev` script has been removed. Start development tasks with the relevant
package's committed scripts, for example `pnpm -C 1-fe-host dev`.
`scripts/dev.mjs` and the port-cleanup helpers remain in the repository, but are
not invoked through a root `pnpm dev` command. `pnpm test:dev` remains available
for their existing tests.

Decision: [root dev removal](../../flow/2026-11-14-remove-root-dev-script.md).

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

## LOCAL-ENV-001: Mac Studio 로컬 연결 설정

애플리케이션은 호스트 프로세스로 실행하며 DB 연결은 Docker 내부 서비스명이 아닌
`127.0.0.1`의 공개 포트를 사용한다. 현재 Mac Studio 프로필은 PostgreSQL `2972`,
Neo4j Browser `2970`/Bolt `2971`, OAuth proxy `2890`, Loki `2973`, Grafana `2974`다.
BFF와 FastAPI의 DB 계정·비밀번호·DB명은 인프라 `.env`와 일치시킨다.
비밀값은 문서에 기록하지 않는다. 실제 데이터의 인증은 TCP/Bolt 연결로 확인한다.

Host의 `/api/langgraph` 프록시는 프로젝트 FastAPI `http://127.0.0.1:8000`을 사용한다.
`2024`는 별도 LangGraph 개발 서버를 명시적으로 사용할 때만 지정한다.
`LANGGRAPH_STANDARD_OPENAPI`는 이 checkout의
`.apb-workspace/docs/01-plan/langgraph-standard.json`을 가리켜야 한다.

Host/BFF 기본 포트 `2800`/`2801`은 현재 다른 Docker 서비스가 점유하고 있다.
이 프로필 동기화는 기존 서비스나 애플리케이션 기본 포트를 변경하지 않는다.
앱 기동 전 포트 충돌 해소 또는 별도 포트 계약 변경이 필요하다.
