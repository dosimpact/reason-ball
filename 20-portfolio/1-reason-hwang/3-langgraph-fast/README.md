# LangGraph Standard API on FastAPI

Open-source FastAPI/LangGraph server that implements the API contract in
`.apb-workspace/docs/01-plan/langgraph-standard.json` without the licensed
`langgraph-api` image. The FastAPI server is the main runtime; a separate
`langgraph dev` runtime is available for local graph testing and Studio.

## Setup

```sh
uv sync
pnpm install
```

## PostgreSQL

The database is provided by the shared infrastructure project. PostgreSQL must already contain the
configured database. The local role needs `CREATE TABLE`, `CREATE INDEX`, and `ALTER TABLE` because
`ENV_PROFILE=local` runs idempotent checkpointer and application migrations at startup. Other
profiles only verify the schema and never execute DDL.

LangGraph application metadata and checkpointer tables live in the schema configured by
`POSTGRES_SCHEMA` (default: `langgraph`). The SEC collector continues to own tables in `public`.
On the first local startup after this separation, existing LangGraph-owned tables are moved from
`public` to `langgraph` under an advisory lock without copying or dropping their data. Non-local
profiles require the dedicated schema to be prepared out of band.

```sh
cd ../infra/1-infra-graph-rag
docker compose --env-file .env up -d postgres
docker compose --env-file .env exec -T postgres \
  sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Copy `.env.example` to `.env`, set the PostgreSQL values, keep
`MAX_CONCURRENT_RUNS=10`, and point `LANGGRAPH_STANDARD_OPENAPI` at the SSOT JSON.

## Run (one worker)

```sh
uv run uvicorn server.server:app --env-file .env \
  --host 127.0.0.1 --port 8000 --workers 1
```

`ENV_PROFILE=dev`, `staging`, and `production` require a schema prepared out of band. Startup fails
when the schema version is missing or outdated.

## Neo4j

Neo4j schema preparation follows the same environment-profile policy as PostgreSQL. With
`ENV_PROFILE=local`, FastAPI startup idempotently prepares ten SEC domain `id` constraints, five modeling
manifest constraints, the embedding cache index and a native 1536-dimensional cosine vector index. With `ENV_PROFILE=dev`, `staging`, or `production`, startup verifies the constraints and vector index settings without executing DDL.
Missing, incompatible or offline required indexes fail validation. Existing legacy graph data is retained.

The explicit initializer remains available for preparing a database out of band:

```sh
uv run python scripts/tenk_init_neo4j.py --database neo4j --pretty
```

## LangGraph development runtime

Run the official lightweight Agent Server separately when testing the compiled graph or using
LangSmith Studio:

```sh
pnpm dev:langgraph
```

The runtime reads `langgraph.json`, loads `main_graph` from
`src/graph/primary_graphs/main_graph/workflow.py`, and listens on `http://127.0.0.1:2024` by default. It is
independent of the FastAPI server above and does not replace the FastAPI API implementation.

## API and validation

```sh
curl http://127.0.0.1:8000/ok?check_db=1
curl http://127.0.0.1:8000/openapi.json
pnpm test
pnpm test:bruno
```

The standard surface includes Assistants, Threads, Thread Runs, Stateless Runs, Streaming, Crons,
Store, A2A, MCP, and System endpoints. Existing `/health` and `/graph/run` routes are
kept as project extensions.

## Runtime policy

- At most 10 graph runs execute concurrently and 10 more wait in FIFO order.
- Overflow receives `429` with `Retry-After`; concurrent runs for the same thread receive `409`.
- `delete_threads=true` removes Assistant/thread/run application metadata but preserves LangGraph
  checkpointer checkpoint, write, and blob rows.
- Run exactly one Uvicorn worker; distributed coordination is outside this service's scope.

## Legacy graph extension

```sh
curl -X POST http://127.0.0.1:8000/graph/run \
  -H 'content-type: application/json' \
  -d '{"message":"Say hello in one sentence","provider":"openai"}'
```

Use `provider: "chatgpt-oauth-proxy"` with `OPENAI_BASE_URL` pointing to the
running OAuth proxy (for example, `http://127.0.0.1:2890/v1`).

## SEC modeling and evidence retrieval

The mock parser and `/api/tenk/*` endpoints have been removed. BFF durable runs invoke
`/internal/sec-modeling/*`; analysis uses `/api/sec-analysis/search`,
`/api/sec-analysis/facts/query`, and `/api/sec-analysis/evidence/{id}`.
All requests use the server-side modeling key; never expose it in browser code.
The original SEC HTML remains in BFF PostgreSQL. Neo4j contains processed Item HTML/text,
lexical evidence and XBRL facts. Existing PoC data remains intact.

The accepted contract and validation status are in
[SEC modeling](../docs/stock/us-corporate-filings/sec-modeling.md).
Implementation is complete. Further validation is deferred at the user’s request; NVDA model 2 and the full 30-question retrieval evaluation remain incomplete.
