# System Design

> Scope: shared, workspace-wide topology and cross-domain architecture. Domain-specific details belong under `docs/stock/us-corporate-filings/` and `docs/stock/index-dcf-visualizer/`.

## Purpose

Reason Hwang is a local-first portfolio platform combining a Next.js user interface, independently delivered React remotes, SEC EDGAR collection, LangGraph-based AI workflows, PostgreSQL and Neo4j persistence, and local observability.

[Editable architecture](overall-architecture.excalidraw) · [PNG with embedded Excalidraw scene](overall-architecture.excalidraw.png)

## Runtime topology

```text
Browser
  |
  +-- Next.js host :2800
  |     +-- /api/remote-proxy/* --> NestJS BFF :2801 --> remote dev server or dist
  |     +-- /api/langgraph/* ----> FastAPI/LangGraph :8000
  |
  +-- NestJS SEC API :2801/api/sec/* --> SEC EDGAR + PostgreSQL
  |
  +-- FastAPI/LangGraph :8000
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

Remote definitions must remain consistent between `1-fe-host/src/lib/remotes.ts` and `2-bff-apps/src/remotes.config.ts`.

## BFF and SEC collector

`2-bff-apps` is a NestJS application with two responsibilities:

1. Deliver remote assets through `/remotes/:name/*`.
2. Expose SEC EDGAR collection and query operations under `/api/sec/*`.

The SEC surface has six endpoints: company synchronization/listing, filing retrieval with original/amendment links, direct single-document content, and selected/all-company backfill POST SSE. Metadata is collected before optional documents; retries are internal. There is no separate parser-status/download/retry/job-status API. PostgreSQL access is implemented with TypeORM entities and migrations. Swagger is enabled by default at `/docs/sec`, with JSON and YAML documents below that path; set `SWAGGER_ENABLED=false` to disable it.

SEC primary-document bodies are stored with metadata in PostgreSQL; report queries no longer read local filing paths. See the [filing system design](../us-corporate-filings/system-design.md) for migration and content-size limits. Bulk submissions ZIP remains a local, reproducible cache.

## FastAPI and LangGraph

`3-langgraph-fast` is the primary AI runtime. The FastAPI application exposes a LangGraph-compatible surface for Assistants, Threads, Thread Runs, Stateless Runs, Streaming, Crons, Store, A2A, MCP, and System operations. Project-specific extensions include `/health`, `/health/postgres`, `/graph/run`, and `/api/tenk/*`.

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
and LangGraph checkpoint data in the dedicated `langgraph` PostgreSQL schema. The BFF's SEC tables
remain in `public`, even when both services share the `sec_collector` database. Local profile startup
may create the dedicated schema, move existing LangGraph-owned tables from `public`, prepare
idempotent schema changes, and migrate legacy snapshots. FastAPI startup also prepares the 10-K
Neo4j uniqueness constraints in the local profile. For both databases, non-local profiles verify
the expected schema without executing DDL and fail fast when it is absent or outdated. The supported
FastAPI deployment is one Uvicorn worker because distributed run coordination is outside the service
boundary.

Do not bypass startup or migration safeguards selected by `ENV_PROFILE`.

The separate `langgraph dev` process on port 2024 is for graph development and Studio; it does not replace the FastAPI implementation on port 8000.

## Data and infrastructure

`infra/1-infra-graph-rag` provisions:

- Neo4j for Graph RAG data.
- PostgreSQL for SEC and LangGraph/application persistence.
- Loki and Alloy for container logs.
- Prometheus, cAdvisor, PostgreSQL exporter, and Neo4j exporter for metrics.
- Grafana for logs, metrics, and provisioned dashboards.

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
