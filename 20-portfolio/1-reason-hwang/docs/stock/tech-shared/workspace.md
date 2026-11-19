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


## Root commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install JavaScript workspace dependencies |
| `pnpm test:dev` | Validate scoped development-port cleanup and collision handling |
| `pnpm build` | Build packages that define a build task |
| `pnpm dev` | Run the host, BFF, and LangGraph FastAPI development servers together |
| `pnpm dev:fe-host` | Run development mode for the frontend host |
| `pnpm dev:bff-apps` | Run development mode for the BFF |
| `pnpm dev:langgraph-fast-api` | Run development mode for LangGraph FastAPI |
| `pnpm test` | Run package tests after dependency builds |
| `pnpm test:e2e` | Run the host Playwright suite |
| `pnpm lint` | Run package lint tasks |
| `pnpm typecheck` | Run package type checks |
| `pnpm clean` | Run package cleanup tasks |
| `pnpm infra:up` | Start infrastructure packages |
| `pnpm infra:ps` | Inspect infrastructure health/status |
| `pnpm infra:down` | Stop infrastructure packages without deleting persisted host data |

## DEV-START-001: App restart before development startup

Root `pnpm dev` invokes the three application packages through Turbo using their
existing `dev` scripts. Individual commands are `dev:fe-host`, `dev:bff-apps`, and
`dev:langgraph-fast-api`. Development mode does not require a production build.
Infrastructure and remote Vite packages are outside this command's scope.
The root does not expose `start` commands; package-level production `start`
scripts remain available and require their normal prerequisites.
`scripts/dev.mjs` is not invoked; existing port listeners are not automatically stopped.


Python packages use `uv`. Run `uv sync` in `3-langgraph-fast` or `infra/2-codex-oauth-proxy` when installing their Python dependencies.

## Configured application endpoints and infrastructure defaults

| Service | Endpoint |
| --- | --- |
| Frontend host | `http://127.0.0.1:2983` |
| BFF and remote provider | `http://127.0.0.1:2980` |
| template remote dev server | `http://127.0.0.1:2984` |
| todo remote dev server | `http://127.0.0.1:2985` |
| FastAPI/LangGraph | `http://127.0.0.1:2981` |
| LangGraph development runtime | `http://127.0.0.1:2982` |
| OAuth proxy | `http://127.0.0.1:2890` (Compose 기본, 컨테이너 내부18741) |
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
- Change history: Git commit/diff; current state: `docs/stock/`.

## DOC-DISCOVERY-001: Documentation navigation

Read AGENTS.md → [documentation map](../../INDEX.md) → common design → relevant package/domain stock → validation policy. Current stock owns implementation, decisions, limitations and reproducible checks. Update it directly when behavior changes; keep commit messages/diffs as the change history rather than adding dated narrative to current design.

The workspace uses the [stock-only documentation baseline](../../INDEX.md#doc-stock-001-현재-상태-중심-문서). Historical process records are available in Git. Missing, failed or fixture-only validation must remain distinguished from actual runtime success.

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

Host의 `/api/langgraph` 프록시는 프로젝트 FastAPI `http://127.0.0.1:2981`을 사용한다.
`2982`는 별도 LangGraph 개발 서버를 명시적으로 사용할 때만 지정한다.
`LANGGRAPH_STANDARD_OPENAPI`는 이 checkout의
`.apb-workspace/docs/01-plan/langgraph-standard.json`을 가리켜야 한다.

## LOCAL-PORTS-002: 애플리케이션 포트 프로필

각 패키지의 로컬 `.env`와 `.env.example`은 BFF 2980, FastAPI 2981,
LangGraph dev 2982, Host 2983, Template Remote 2984, Todo Remote 2985를 설정한다.
기존 Docker 서비스의 2800/2801 포트를 변경하거나 종료하지 않는다.

- FastAPI: `SERVER_PORT`, LangGraph dev: `LANGGRAPH_PORT`를 uv가 로드한 뒤 CLI `--port`에 전달한다.
- Host: `next dev --turbopack` / `next start`를 직접 실행한다. 앱 환경변수는 Next가 `.env`에서 자동 로드하며 별도 Node 환경파일 wrapper는 없다. 기본 포트는 스크립트의 `--port 2983`이고 `pnpm dev --port <번호>`로 덮어쓴다. `.env`의 `PORT`는 서버 포트에 적용되지 않는다.
- BFF: 기존 dotenv 설정의 `PORT`를 사용한다. `REMOTE_TEMPLATE_URL`/`REMOTE_TODO_URL`은 개발 Remote 주소다.
- Vite Remote: `loadEnv`의 `PORT`와 `REMOTE_BFF_URL`을 사용한다. 개발·preview 포트는 동일하고 `strictPort`를 유지한다.
- Host의 FastAPI 프록시 4종과 `REMOTE_BFF_URL`, FastAPI의 SEC BFF·UI validator 주소도 새 포트로 연결한다.
- 실행 중인 프로세스에는 소급 적용되지 않으므로 해당 서비스의 `pnpm dev`를 재실행한다.
- 루트 `pnpm dev`는 기존과 같이 Host/BFF/FastAPI만 실행한다. LangGraph dev와 두 Remote는 각 패키지에서 별도로 실행한다.


## LOCAL-NGINX-001: 외부 도메인 연결 기록

사용자 제공 Nginx 설정 화면은 Host/BFF/FastAPI를 각각
`reason-web.flin-ai.com`/`reason-bff.flin-ai.com`/`reason-langgraph-fast.flin-ai.com`에서
호스트의 2983/2980/2981로 전달한다. LangGraph dev 도메인
`reason-dev-langgraph.flin-ai.com`의 전달 대상은 화면상 `dodonet.iptime.org:2982`다.
Grafana/Neo4j Browser는 호스트의 2974/2970으로 전달한다.
이 기록은 제공된 설정의 정리이며 실제 외부 연결 검증 결과가 아니다.
화면의 PostgreSQL HTTP 대상 5433은 현재 DB TCP 포트 2972와 다르며 DB 접속 주소로 취급하지 않는다.
상세 연결표는 사용자 요청으로 정리한 [로컬 서버 설정](../../human-docs/server설정.local.md)을 참조한다.

## DEV-SERVICE-DEFAULTS-001: 기본 재시작 범위

사용자의 별도 요청이 없으면 서비스 시작·전체 재시작 대상은 BFF2980, FastAPI2981, LangGraph dev2982, Host2983이다. Template2984와 Todo2985는 기본 실행 대상에서 제외하며 명시적으로 요청할 때만 실행한다. 패키지와 기능은 유지하고 기본 운영 프로세스만 종료한다.


## DEV-CACHE-001: Host 개발 캐시 복구

Turbopack가 생성한 chunks/ssr runtime을 찾지 못하면 먼저 Host 소유 supervisor·자식 프로세스와 포트를 확인하고 정상 종료한다. 해당 Host의 `.next` 생성 캐시만 제거한 다음 `pnpm -C 1-fe-host dev`로 다시 실행한다. 실행 중인 서버의 캐시를 삭제하거나 다른 앱·DB 볼륨을 정리하지 않는다. 주요 경로 HTTP 응답과 missing-module 오류 재발 여부를 확인한다. 이 절차는 원인이 확인된 캐시 불일치 복구이며 임의 애플리케이션 오류의 공통 해결책은 아니다.
