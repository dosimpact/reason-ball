# 10-K Assistant Operations Runbook

이 문서는 로컬 개발/검증 환경에서 10-K investment assistant가 깨졌을 때
운영자가 바로 확인하고 복구할 수 있는 절차를 정리합니다.

## 1. Target Map

| Target | Role | Default Endpoint |
| --- | --- | --- |
| `0-harness` | workspace orchestration, shared pnpm/turbo scripts | root commands |
| `1-infra-graph-rag` | PostgreSQL, Neo4j, Grafana/Loki | PostgreSQL `55432`, Neo4j `7474/7687` |
| `2-10-k-collector` | SEC company/filing metadata and filing files | `http://127.0.0.1:3305/api` |
| `3-10-k-parser` | parser, Neo4j retrieval, LangGraph-style runtime | `http://127.0.0.1:3406` |
| `4-10-k-chat-bot-next` | authenticated chat UI, CopilotKit adapter, SEC admin tools | `http://127.0.0.1:3003` |

## 2. Baseline Bring-up

Run from the repository root unless noted.

```bash
pnpm install
pnpm run dev
```

`pnpm run dev` starts infra, runs the chatbot database migration, and launches
collector, parser, and chatbot dev servers. Use `pnpm run infra:up` only when
you intentionally need the database/Neo4j/Grafana/Loki stack without app
servers.

For a production-like local start:

```bash
pnpm run build
pnpm run start
```

Expected local ports:

- PostgreSQL: `127.0.0.1:55432`
- Collector API: `127.0.0.1:3305`
- Parser runtime: `127.0.0.1:3406`
- Chatbot UI: `127.0.0.1:3003`
- Neo4j Browser: `127.0.0.1:7474`
- Grafana: `127.0.0.1:3001`
- Loki: `127.0.0.1:3100`

## 3. Fast Health Checks

```bash
pnpm --filter @10k/infra run infra:ps
curl -s http://127.0.0.1:3305/api/filings/status-summary
curl -s http://127.0.0.1:3406/health
curl -s http://127.0.0.1:3003/api/copilotkit/info
```

If these pass, run the full gate:

```bash
pnpm run build
pnpm run test:unit
pnpm run test:e2e
```

For automated project-wide checks:

```bash
pnpm run doctor
pnpm run doctor:verify
pnpm run doctor:probe
pnpm run doctor:e2e
pnpm run test:graph-rag
```

`doctor` is a fast static contract check. `doctor:verify` adds syntax,
whitespace, lint, build, and unit gates. `doctor:probe` expects services to
already be running and fails when required TCP/HTTP probes are unavailable.
`doctor:probe:local` starts infra, runs the chatbot DB migration, launches the
collector/parser/chatbot services, runs the same live probe gate, and then
cleans up the app services and infra stack.
Live probes include a short startup grace for services such as Loki, Grafana,
Next.js, and Uvicorn that can return temporary failures immediately after
container or dev-server startup. Internal HTTP probes also send `x-request-id`
and require collector, parser, and chatbot responses to echo the same value.
The collector, parser, and chatbot probes parse JSON bodies and fail if core
response contracts drift, such as parser `/health.runtimeStore.foreignKeyCascade`
not being `true`.

`test:graph-rag` is the real SEC ingestion smoke. It starts infra, collector,
and parser, seeds one target ticker from SEC, writes the filing through the
parser into Neo4j with the deterministic mock extractor, and verifies
`/api/graph-rag/query` returns evidence for that filing.

## 4. Environment Contract

Set these values consistently across the root scripts and service `.env` files.

| Variable | Used By | Default |
| --- | --- | --- |
| `POSTGRES_URL` | chatbot database | `postgresql://postgres:postgres@127.0.0.1:55432/chat_bot` |
| `DATABASE_URL` | collector database | `postgresql://postgres:postgres@127.0.0.1:55432/sec_collector` |
| `COLLECTOR_DATABASE_URL` | chatbot SEC repository | `postgresql://postgres:postgres@127.0.0.1:55432/sec_collector` |
| `COLLECTOR_DATA_DIR` | chatbot filing reader | `./2-10-k-collector` from root, or `../2-10-k-collector` from chatbot |
| `PARSER_BACKEND_URL` | chatbot parser-backed chat | `http://127.0.0.1:3406` |
| `NEO4J_URI` | parser retrieval and graph write | `bolt://127.0.0.1:7687` |
| `PARSER_BACKEND_BASE_URL` | parser local API self/base URL | `http://localhost:3406` |
| `RUNTIME_DB_PATH` | parser LangGraph-style runtime SQLite state | `./data/runtime.db` |
| `RUNTIME_STORE_MAX_THREADS` | parser runtime SQLite retained thread cap | `500` |
| `RUNTIME_STORE_RETENTION_DAYS` | parser runtime SQLite retention age | `30` |
| `PARSER_JOB_STORE_MAX_JOBS` | parser collector-parse job status retention | `1000` |
| `PARSER_JOB_STORE_TTL_SECONDS` | parser completed/failed job status TTL | `86400` |
| `SEC_USER_AGENT` | collector SEC calls | must include an app/contact string |

Collector package scripts export the local `55432` database default before
loading application configuration when `DATABASE_URL` is not already set in the
shell. This keeps `pnpm --filter @10k/collector run companies:sync` aligned
with root `infra:up` even if an old local `.env` file still contains a stale
PostgreSQL port.

## 5. Generated Runtime Artifacts

The following files are local runtime or packaging artifacts and should stay out
of source control:

- `/data/runtime.db`: parser LangGraph-style runtime SQLite state
- `3-10-k-parser/data/runtime.db`: parser LangGraph-style runtime SQLite state
- `/logs/`: local dev-server logs captured during smoke/debug runs
- `*.egg-info/`: Python packaging metadata generated by editable installs or
  build tooling

If these appear in `git status`, check `.gitignore` before committing. Preserve
fixtures, examples, and source files separately instead of storing them under the
ignored runtime paths.

## 6. Live Doctor Probes

For the full local lifecycle in one shell:

```bash
pnpm run doctor:probe:local
```

This command is the easiest way to reproduce the live probe gate from a clean
local state. It restores the `next-env.d.ts` snapshot after Next dev exits and
runs `pnpm run infra:down` during cleanup.

For manual probing, start services first:

```bash
pnpm run dev
```

Then run the probe from another shell:

```bash
pnpm run doctor:probe
```

If you are probing a slow machine or a cold Docker start, increase the retry
budget for one run:

```bash
DOCTOR_PROBE_ATTEMPTS=30 DOCTOR_PROBE_DELAY_MS=1000 pnpm run doctor:probe
```

The live probe gate checks:

- PostgreSQL TCP `127.0.0.1:55432`
- Neo4j Bolt TCP `127.0.0.1:7687`
- Neo4j Browser HTTP `http://127.0.0.1:7474`
- Loki ready HTTP `http://127.0.0.1:3100/ready`
- Grafana health HTTP `http://127.0.0.1:3001/api/health`
- Collector filing status API `http://127.0.0.1:3305/api/filings/status-summary`
- Parser health API `http://127.0.0.1:3406/health`
- Chatbot CopilotKit info API `http://127.0.0.1:3003/api/copilotkit/info`

The collector, parser, and chatbot probes also verify `x-request-id` echo and
stable JSON body shape so operators can correlate browser/API errors with
service logs while catching malformed health/status responses early.

## 7. Request ID Log Correlation

Every chatbot, collector, and parser HTTP response should include
`x-request-id`. When an SEC API response body contains `requestId`, use the same
value to find the related server-side event.

SEC structured failures emit a JSON warning shaped like:

```json
{"event":"sec_api_problem","code":"sec_company_not_found","status":404,"requestId":"req_example","hasCause":true,"hasRecovery":true}
```

Collector and parser HTTP requests also emit searchable access events:

```json
{"event":"collector_http_request","service":"10k-collector","requestId":"req_example","method":"GET","path":"/api/filings/status-summary","status":200,"durationMs":12}
```

```json
{"event":"parser_http_request","service":"10k-parser","requestId":"req_example","method":"GET","path":"/health","status":200,"durationMs":2}
```

Collector job endpoints return `correlationId` in their JSON response. Parser
collector-parse jobs store the same value as `correlationId`, pass it to
collector API calls as `x-request-id`, record collector echoed request IDs in
`collectorRequestIds`, expose `collectorRequestIdMatched`, and emit job
lifecycle events:

```json
{"event":"parser_collector_parse_job","jobId":"job-uuid","correlationId":"req_example","status":"completed","success":3,"failed":0}
```

Local dev log lookup:

```bash
pnpm run dev 2>&1 | rg 'sec_api_problem|collector_http_request|parser_http_request|parser_collector_parse_job|req_example'
```

Live probe lookup:

```bash
pnpm run doctor:probe
```

`doctor:probe` creates a lightweight parser collector-parse job with a future
`since` filter and fails unless the parser job keeps the inbound request ID as
`correlationId` and the collector echoes the same ID for parser-initiated
collector API calls.

Loki/Grafana lookup:

```logql
{job="containers"} |~ "sec_api_problem|collector_http_request|parser_http_request|parser_collector_parse_job" |= "req_example"
```

The log intentionally records whether a raw cause exists, but not the raw cause
text. This keeps operator correlation useful without copying database strings or
other low-level failure details into searchable logs.

## 7. Symptom Playbooks

### Collector API or Schema Unavailable

Symptoms:

- SEC admin playground shows collector database errors.
- Investment assistant runtime status mentions PostgreSQL, collector schema, or filing catalog failure.
- `/api/sec/filings` returns a structured collector error.

Check:

```bash
pnpm --filter @10k/infra run infra:ps
curl -s http://127.0.0.1:3305/api/filings/status-summary
```

Recover:

```bash
pnpm run infra:up
pnpm --filter @10k/collector run build
pnpm --filter @10k/collector run start:dev
```

Success criteria:

- PostgreSQL is up on `55432`.
- Collector responds on `3305`.
- `filings/status-summary` returns JSON instead of a connection or schema error.

### Investment Assistant Data Readiness Is Not Ready

Symptoms:

- The investment assistant shows `Data Readiness: Action needed`.
- The Data Readiness card marks `Filing catalog`, `Local filing text`,
  `Parser graph`, `Filing freshness`, or `Runtime dependencies` as incomplete.
- The user can see a filing or brief, but the workspace still says the data is
  not production-ready.

Check:

```bash
curl -s 'http://127.0.0.1:3305/api/filings/status-summary'
curl -s 'http://127.0.0.1:3305/api/filings?limit=5'
curl -s http://127.0.0.1:3406/health
```

Recover by the failing readiness item:

- `Filing catalog`: run company sync and filing metadata sync for the target
  ticker or CIK.
- `Local filing text`: run the filing download or retry job until the target
  filing is downloaded.
- `Parser graph`: run the parser collector parse job, then ask for
  graph-grounded evidence again.
- `Filing freshness`: rerun company sync, filing metadata sync, download, and
  parser jobs before making a latest-filing decision.
- `Runtime dependencies`: follow the specific recovery text in the Runtime
  Status card first.

Success criteria:

- Data Readiness changes to `Ready`, or the remaining item shows a specific
  non-blocking action.
- Decision Quality is evaluated after Data Readiness rather than hiding missing
  source-pipeline work.

### Missing or Stale Filing Metadata

Symptoms:

- Assistant shows `Freshness: unknown`.
- Assistant shows `Freshness: refresh recommended`.
- Recent filing rows are empty or older than expected.

Check:

```bash
curl -s 'http://127.0.0.1:3305/api/filings?limit=5'
curl -s 'http://127.0.0.1:3305/api/filings/status-summary'
```

Recover:

```bash
curl -s -X POST http://127.0.0.1:3305/api/company-sync-jobs
curl -s -X POST http://127.0.0.1:3305/api/filing-sync-jobs \
  -H 'content-type: application/json' \
  -d '{"tickers":["AAPL"],"since":"2025-01-01"}'
curl -s -X POST http://127.0.0.1:3305/api/filing-download-jobs \
  -H 'content-type: application/json' \
  -d '{"tickers":["AAPL"],"since":"2025-01-01","maxFiles":5}'
```

If the assistant reports a stale collector timestamp, repeat the filing sync for
the target ticker or CIK instead of scanning broad page ranges first.

Success criteria:

- Filing rows include recent `updated_at` values.
- Assistant provenance shows `Collector updated:` with a concrete timestamp.
- Freshness changes from `unknown` or `refresh recommended` to `current`.

### Filing File Missing or Download Failed

Symptoms:

- Assistant or SEC API reports a local filing file is unavailable.
- Filing metadata exists, but full text/summary/brief cannot read content.
- `status` is `pending` or `failed`.

Check:

```bash
curl -s 'http://127.0.0.1:3305/api/filings?status=pending&limit=20'
curl -s 'http://127.0.0.1:3305/api/filings?status=failed&limit=20'
```

Recover:

```bash
curl -s -X POST http://127.0.0.1:3305/api/filing-retry-jobs \
  -H 'content-type: application/json' \
  -d '{"limit":100,"since":"2025-01-01"}'

curl -s -X POST http://127.0.0.1:3305/api/filing-download-jobs \
  -H 'content-type: application/json' \
  -d '{"maxFiles":200,"since":"2025-01-01"}'
```

Success criteria:

- Target filing status becomes `downloaded`.
- `downloaded-reports` returns content for the target ticker/CIK.
- Chatbot SEC full-text, summary, and investment-brief APIs stop returning file-unavailable errors.

### Parser Runtime Unavailable

Symptoms:

- Chat UI shows parser-runtime degraded status.
- Runtime status mentions port `3406`.
- Chat streaming fails before retrieval begins.

Check:

```bash
curl -s http://127.0.0.1:3406/health
```

Recover:

```bash
pnpm --filter @10k/parser run build
pnpm --filter @10k/parser run dev
```

Success criteria:

- `/health` responds on `3406`.
- `/health` includes `jobStore.maxJobs` and `jobStore.ttlSeconds`.
- `/health` includes `runtimeStore.dbPath`, `runtimeStore.threads`, and
  `runtimeStore.runs`, plus `runtimeStore.maxThreads` and
  `runtimeStore.retentionDays`.
- `/health.runtimeStore.foreignKeyCascade` is `true`, so runtime runs are
  removed automatically when their parent thread is deleted.
- `POST /api/langgraph/threads` creates a thread.
- Chatbot `PARSER_BACKEND_URL` points to `http://127.0.0.1:3406`.

Parser collector-parse job status is process-local and bounded. Completed,
completed-with-errors, and failed jobs are retained for
`PARSER_JOB_STORE_TTL_SECONDS` and then evicted; if the store exceeds
`PARSER_JOB_STORE_MAX_JOBS`, the oldest terminal jobs are evicted first. Running
jobs are not intentionally removed by retention cleanup. Use the job response
`correlationId` and `parser_collector_parse_job` logs for long-term audit trails.

### Graph RAG or Neo4j Retrieval Failure

Symptoms:

- Assistant runtime status mentions Graph RAG or Neo4j.
- Parser stream starts but evidence retrieval fails.
- Answers lack filing evidence even though files are collected.

Check:

```bash
pnpm --filter @10k/infra run infra:ps
curl -s http://127.0.0.1:3406/health
```

Recover:

```bash
pnpm run infra:up
cd 3-10-k-parser
UV_BIN=$(sh ../scripts/ensure-uv.sh)
"$UV_BIN" run --project . python -m parser.cli init-neo4j --pretty
"$UV_BIN" run --project . python -m parser.cli parse-manifest \
  --manifest examples/mock_documents.json \
  --limit 1 \
  --pretty
```

To index real downloaded SEC filings instead of the mock manifest, seed the
collector first and then queue only unparsed downloaded filings:

```bash
curl -s -X POST http://127.0.0.1:3406/api/parser/collector/parse-jobs \
  -H 'content-type: application/json' \
  -d '{"ticker":"AAPL","since":"2025-01-01","pageSize":1,"parserStatus":""}'
```

Success criteria:

- Neo4j is reachable at `bolt://127.0.0.1:7687`.
- Parser retrieval returns an evidence bundle.
- The collector filing row moves from empty `parser_status` to `parsed` after a
  non-dry-run collector parse job.
- Chat UI no longer shows Graph RAG degraded status for the same prompt.

### Chatbot Database or Auth Failure

Symptoms:

- Chat UI loads but guest session, chat creation, or stream resume fails.
- Next.js logs mention Drizzle, `POSTGRES_URL`, or missing chat tables.

Check:

```bash
pnpm --filter @10k/infra run infra:ps
pnpm --filter @10k/chatbot run db:migrate
```

Recover:

```bash
pnpm run infra:up
pnpm --filter @10k/chatbot run db:migrate
pnpm --filter @10k/chatbot run dev
```

Success criteria:

- Guest auth route returns a session.
- New chat creation succeeds.
- Stream resume endpoint returns valid SSE or a structured empty stream state.

## 8. Release Gate

Before treating the project as locally releasable, run:

```bash
pnpm run doctor:verify
pnpm run build
pnpm run test:unit
pnpm run test:e2e
pnpm run test:graph-rag
```

The current E2E scope must include:

- investment assistant inline panels
- SEC API response contracts
- admin SEC playground interactions
- runtime degraded-state cards
- stale and unknown filing freshness guidance
- real SEC filing ingestion into Neo4j and Graph RAG evidence retrieval

GitHub Actions:

- `.github/workflows/project-gates.yml` runs on pull requests and `main` pushes.
- The `Doctor Verify` job installs dependencies with `pnpm install --frozen-lockfile`
  on Node 24, then runs `pnpm run doctor:verify`.
- The `Browser E2E` job installs Chromium and runs `pnpm run test:e2e`.
- The `Live Graph RAG Smoke` job runs `pnpm run test:graph-rag` on the nightly
  schedule and when manually dispatched with `run_graph_rag=true`.
- Static `project-doctor` checks require this workflow and its core commands, so
  CI gate drift is caught during local verification.

## 9. Shutdown and Cleanup

```bash
pnpm run infra:down
```

If a verification run leaves background services behind, check:

```bash
lsof -nP -iTCP:3003 -sTCP:LISTEN
lsof -nP -iTCP:3305 -sTCP:LISTEN
lsof -nP -iTCP:3406 -sTCP:LISTEN
```

Only remove Docker volumes with `pnpm --filter @10k/infra run clean` when losing
local PostgreSQL/Neo4j state is acceptable.
