# System Design

> Scope: shared, workspace-wide topology and cross-domain architecture. Domain-specific details belong under `docs/stock/us-corporate-filings/` and `docs/stock/index-dcf-visualizer/`.

## Purpose

Reason Hwang is a local-first portfolio platform combining a Next.js user interface, independently delivered React remotes, SEC EDGAR collection, LangGraph-based AI workflows, PostgreSQL and Neo4j persistence, and local observability.

[Editable architecture](overall-architecture.excalidraw) · [PNG with embedded Excalidraw scene](overall-architecture.excalidraw.png)

## Runtime topology

```text
Browser
  |
  +-- Next.js host :2983
  |     +-- /api/remote-proxy/* --> NestJS BFF :2980 --> remote dev server or dist
  |     +-- /api/langgraph/* ----> FastAPI/LangGraph :2981
  |
  +-- NestJS SEC API :2980/api/sec/* --> SEC EDGAR + PostgreSQL
  |
  +-- FastAPI/LangGraph :2981
        +-- PostgreSQL (application state and LangGraph checkpoints)
        +-- Neo4j (10-K/Graph RAG data)
        +-- model provider or local OAuth proxy :18741

Docker observability:
  container logs --> Alloy --> Loki ----+
  containers/DBs --> exporters --> Prometheus --> Grafana
```

## Frontend host

`1-fe-host` is a Next.js App Router application. It owns the shared shell, sidebar navigation, remote mounting, chat UI, and index DCF visualization.

Implemented page routes:

| Route | Purpose |
| --- | --- |
| `/` | Host landing page |
| `/remotes/template` | Template federated remote |
| `/remotes/todo` | Todo federated remote |
| `/chat` | LangGraph-backed chat UI |
| `/index-dcf-visualizer` | Index DCF calculation and visualization |
| `/sec-collector` | SEC collection operations |
| `/sec-modeling` | SEC modeling runs, processed results and evidence search |

The host exposes same-origin server routes `/api/remote-proxy/[...path]` and `/api/langgraph/[...path]`. This keeps browser requests behind the host and avoids coupling UI code to local service origins.

## Micro-frontend delivery

The host registers `template` and `todo` at runtime with `@module-federation/runtime`. Each Vite remote uses `@module-federation/vite`, emits `remoteEntry.js`, and exposes `./mount`. React sharing is deliberately disabled with `shared: {}` so each remote owns its React runtime.

The delivery path is:

```text
Browser
  -> /api/remote-proxy/remotes/{name}/remoteEntry.js on Next.js
  -> /remotes/{name}/remoteEntry.js on the BFF
  -> Vite server in development, or remotes/{name}/dist in production
```

Do not load remote dev servers directly from the host or introduce a shared React singleton without an explicit architecture decision. Keep remote delivery and SEC modules independently testable.

Remote definitions must remain consistent between `1-fe-host/src/shared/lib/remotes.ts` and `2-bff-apps/src/remotes.config.ts`.

## BFF and SEC collector

`2-bff-apps` is a NestJS application with two responsibilities:

1. Deliver remote assets through `/remotes/:name/*`.
2. Expose SEC EDGAR collection, query and modeling operations under `/api/sec/*`.

The SEC collection surface has seven endpoints: company synchronization/listing, filing retrieval with original/amendment links, direct single-document content, accession-specific download/retry SSE, and selected/all-company backfill POST SSE. The accession-specific operation requires an existing filing record and affects only that CIK+accession pair. Modeling run controls live under `/api/sec/modeling/*`. PostgreSQL access is implemented with TypeORM entities and migrations. Swagger is enabled by default at `/docs/sec`, with JSON and YAML documents below that path; set `SWAGGER_ENABLED=false` to disable it.

SEC primary-document bodies are stored with metadata in PostgreSQL; report queries no longer read local filing paths. See the [filing system design](../us-corporate-filings/system-design.md) for migration and content-size limits. Bulk submissions ZIP remains a local, reproducible cache.

## FastAPI and LangGraph

`3-langgraph-fast` is the primary AI runtime. The FastAPI application exposes a LangGraph-compatible surface for Assistants, Threads, Thread Runs, Stateless Runs, Streaming, Crons, Store, A2A, MCP, and System operations. Project-specific extensions include `/health`, `/health/postgres`, `/graph/run`, and `/api/sec-analysis/*` and `/internal/sec-modeling/*`.

The main graph lives under `3-langgraph-fast/src/graph/primary_graphs/main_graph/`, separating
top-level application graphs from reusable graphs under `src/graph/subgraph/`. It composes
subgraphs and tools for starter flows, price collection, technical analysis, and 10-K processing.
Technical indicators are implemented behind the technical-analysis infrastructure boundary. The
service can call a configured OpenAI-compatible provider, including the local OAuth proxy.

The `simple_llm` primary graph is registered from
`3-langgraph-fast/src/graph/primary_graphs/simple_llm/workflow.py`. It is a self-contained primary
graph that owns its state, ReAct node, prompts boundary, MCP boundary, and Open-Meteo-backed
`get_weather` tool. It does not depend on a subgraph implementation.

When PostgreSQL is configured, the application persists assistant, thread, run, cron, store, A2A,
and LangGraph checkpoint data in the dedicated `langgraph` PostgreSQL schema. The BFF's collected SEC tables
remain in `public`, while its modeling execution tables use `sec_modeling`, even when both services share the `sec_collector` database. Local profile startup
may create the dedicated schema, move existing LangGraph-owned tables from `public`, prepare
idempotent schema changes, and migrate legacy snapshots. FastAPI startup also prepares the 10-K
Neo4j uniqueness constraints in the local profile. For both databases, non-local profiles verify
the expected schema without executing DDL and fail fast when it is absent or outdated. The supported
FastAPI deployment is one Uvicorn worker because distributed run coordination is outside the service
boundary.

Do not bypass startup or migration safeguards selected by `ENV_PROFILE`.

The separate `langgraph dev` process on port 2982 is for graph development and Studio; it does not replace the FastAPI implementation on port 2981.

## Data and infrastructure

`infra/1-infra-graph-rag` provisions:

- Neo4j for Graph RAG data.
- PostgreSQL for SEC and LangGraph/application persistence.
- Loki and Alloy for container logs.
- Prometheus, cAdvisor, PostgreSQL exporter, and Neo4j exporter for metrics.
- Grafana for logs, metrics, and provisioned dashboards.

INFRA-COMPOSE-003: PostgreSQL, Neo4j, and monitoring are defined in `docker-compose.postgres.yml`, `docker-compose.neo4j.yml`, and `docker-compose.monitoring.yml`. Package scripts combine all three files into the existing single Compose project, preserving exporter dependencies. Group `up`, `stop`, and `ps` commands are documented in the [package design](../../../infra/1-infra-graph-rag/docs/design.md#infra-compose-003-역할별-compose-파일).

Services communicate on the `graph-rag` Docker network. Persistent data is bind-mounted below the configured `VOLUME_PREFIX`. Infrastructure data must not be deleted as part of normal cleanup.

`infra/2-codex-oauth-proxy` provides `/v1/responses`, `/v1/chat/completions`, `/v1/models`, and `/health`. It uses a local ChatGPT OAuth token rather than an API key. The token at `.config/chatgpt_auth.json` is secret local state and must never be committed. Its Docker image contains only the `aiohttp` runtime dependency and proxy code; OpenAI SDK and LangGraph example dependencies remain in the local development dependency group. The container listens on port `18741`, while its standalone Compose file publishes it to loopback port `2890` by default and supports overriding the host port with `CODEX_OAUTH_PROXY_PORT`.

## Security boundaries

- Keep browser access to remotes and LangGraph behind the Next.js proxy unless an explicit architecture change is accepted.
- Do not expose OAuth token files or `.env` secrets.
- Disable public Swagger exposure in environments where API discovery is not intended.
- Use environment-specific database credentials; example credentials are development placeholders only.
- Treat exporter/database privileges as local-development defaults and use restricted monitoring roles in production.

## Detailed references

- SEC contract: `2-bff-apps/src/us-corporate-filings/.docs/api-spec.md`.
- LangGraph runtime: `3-langgraph-fast/README.md`.
- Infrastructure: `infra/1-infra-graph-rag/docs/design.md`.
- OAuth proxy: `infra/2-codex-oauth-proxy/docs/Design.md`.
- Package-specific technical detail and preserved reference notes: [tech-shared map](INDEX.md).

## SEC Intelligent UI 경로

`/sec-chat` → `/api/sec-chat/*` → FastAPI `/api/sec-chat/*` → SEC BFF + 모델 provider. AG-UI 전송과 OpenUI 렌더링을 사용하며 [Generative UI 통합](openui-migration.md)의 공통 최종 출력 서브그래프와 카탈로그를 공유한다. [도메인 설계](../us-corporate-filings/intelligent-ui.md)를 따른다.

SEC Chat의 기업/공시 조회는 공통 SEC tool calling으로 실행하며, 독립 `sec_deep_agent` 그래프는 자율 조사와 리포트를 제공한다. [구현 계약](3-langgraph-fast/sec-intelligent-ui.md#sec-deep-001003-공통-sec-tools와-독립-deep-agent).

## FE-FSD-001 / SEC-ADMIN-001

Host `src` 전체는 FSD 레이어와 Steiger 권장 규칙을 적용한다. Next 라우트 진입점은 루트 `app/`, 구현은 `_app`, `_pages`, `widgets`, `shared`에 둔다. [Host 구조](1-fe-host/2-frontend-side-architecture.md#fe-fsd-001-host의-feature-sliced-design)를 따른다. `/sec-api-agent`는 독립 SEC Deep Agent를 OpenUI `AgentInterface`와 연결한 관리자 업무용 채팅이다. 기존 `/sec-chat`의 인용 검증과 추천 질문 흐름은 유지한다. [SEC 기능 원본](../sec-chat.md#sec-api-관리자-채팅).

## TA-QUERY-001: 모델 없는 금융 데이터 조회

기술적 분석 OpenUI는 기존 Host `/api/langgraph` 프록시로 Python `GET /technical-analysis/chart`를 조회한다. 이 API는 FastAPI와 LangGraph development custom `http.app`에 같은 router를 등록하며 Yahoo·TA-Lib를 재사용한다. 차트 조건 변경·polling은 그래프 run과 모델 provider를 호출하지 않는다. 초기 분석과 해석의 모델 경계는 유지한다. 구체 계약은 [기술적 분석 시스템 설계](../technical-analysis/system-design.md#ta-query-001-조회-api와-차트-runtime), Host provider는 [OpenUI Host](1-fe-host/open-ui.md#ta-query-001-금융-query-provider)를 따른다.

## SEC-MODELING-001: 분석 작업과 검색 경계

Host `/sec-modeling` → same-origin BFF proxy → `/api/sec/modeling/*`이 작업을 제어한다.
BFF PostgreSQL의 `sec_modeling` schema가 실행 이력을 보존하고 FastAPI가 모델링을 실행한다.
Neo4j는 원본 전체가 아닌 가공 결과·lexical graph·XBRL 사실·벡터를 저장한다.
검색·근거 조회 시 BFF 원문 조회 의존성을 만들지 않는다. OAuth 추출 호출과 OpenAI 임베딩
호출은 별도 provider 설정을 사용한다. Qdrant·pgvector·Redis는 이 경로에 도입하지 않는다.
[도메인 계약](../us-corporate-filings/sec-modeling.md),
[Python 구현 경계](3-langgraph-fast/4-graph-db.md),
[BFF 소유 경계](2-bff-apps/directory-policy.md#sec-modeling-001-모델링-실행-확장)를 따른다.
통합 검증 진행 중이며 완료 증거는 dated flow에 기록한다.
