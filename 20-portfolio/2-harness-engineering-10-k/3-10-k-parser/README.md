# 3-10-k-parser

10-K, 10-Q, 6-K, 20-F 문서를 파싱해서 Neo4j graph로 적재하고, 그 graph를 기반으로 LangGraph-style retrieval/runtime API까지 제공하는 Python backend입니다.

## 현재 범위

이 프로젝트는 지금 기준으로 아래 3가지를 담당합니다.

1. `parse / extract / graph write`
2. `Neo4j-backed retrieval`
3. `LangGraph-style runtime API`

브라우저 chat adapter는 범위 밖입니다. 이 저장소의 핵심 검증 대상은 `3-10-k-parser` API입니다.

## 아키텍처

기본 파이프라인:

1. `segment`
문서를 Item 기준 섹션과 청크로 분리합니다.

2. `extract`
섹션별 statement, fact, entity, metric, risk를 추출합니다.

3. `map`
`Company`, `Filing`, `Item`, `SectionText`, `Statement`, `Fact`, `Entity`, `Metric`, `Risk` 노드와 관계로 projection 합니다.

4. `write`
Neo4j에 upsert 합니다.

5. `retrieve`
질문을 intent로 분류하고 Neo4j에서 evidence bundle을 조회합니다.

6. `runtime`
thread 생성, stream 실행, snapshot 조회, latest stream resume를 제공합니다.

## 디렉터리 가이드

- `src/parser/cli.py`
  CLI entrypoint
- `src/parser/api/server.py`
  FastAPI 서버 조립
- `src/parser/api/langgraph_router.py`
  LangGraph-style runtime API
- `src/parser/core/pipeline.py`
  parse orchestration
- `src/parser/segmenter.py`
  filing segmentation
- `src/parser/llm/extractor.py`
  extraction engine
- `src/parser/graph_mapper.py`
  graph projection
- `src/parser/storage/neo4j_writer.py`
  Neo4j writer
- `src/parser/retrieval/service.py`
  retrieval service
- `src/parser/runtime/store.py`
  runtime thread/run persistence
- `bruno-api-tests/`
  parser API E2E validation

## Graph Model

주요 노드:

- `Company`
- `Filing`
- `Item`
- `SectionText`
- `Statement`
- `Fact`
- `Entity`
- `Metric`
- `Risk`

주요 관계:

- `(:Company)-[:FILED]->(:Filing)`
- `(:Filing)-[:HAS_ITEM]->(:Item)`
- `(:Item)-[:HAS_SECTION]->(:SectionText)`
- `(:SectionText)-[:HAS_STATEMENT]->(:Statement)`
- `(:Statement)-[:SUPPORTED_BY]->(:Fact)`
- `(:Statement)-[:MENTIONS]->(:Entity)`
- `(:Item)-[:HAS_METRIC]->(:Metric)`
- `(:Item)-[:HAS_RISK]->(:Risk)`

## Quick Start

### 1. 설치

```bash
cd 3-10-k-parser
pnpm run python:sync
cp .env.example .env
```

기본 설정은 `codex-cli` extractor 기준입니다.

### 2. Neo4j 제약조건 초기화

```bash
cd 3-10-k-parser
UV_BIN=$(sh ../scripts/ensure-uv.sh)
"$UV_BIN" run --project . python -m parser.cli init-neo4j --pretty
```

### 3. mock manifest 파싱

```bash
cd 3-10-k-parser
UV_BIN=$(sh ../scripts/ensure-uv.sh)
"$UV_BIN" run --project . python -m parser.cli parse-manifest \
  --manifest examples/mock_documents.json \
  --limit 1 \
  --pretty
```

### 4. API 서버 실행

```bash
cd 3-10-k-parser
pnpm run dev
```

## CLI

### `init-neo4j`

```bash
UV_BIN=$(sh ../scripts/ensure-uv.sh)
"$UV_BIN" run --project . python -m parser.cli init-neo4j --pretty
```

### `parse-file`

```bash
UV_BIN=$(sh ../scripts/ensure-uv.sh)
"$UV_BIN" run --project . python -m parser.cli parse-file \
  --path /absolute/path/to/filing.txt \
  --company-name "Sample Technology Inc." \
  --ticker SAMP \
  --report-type 10-K \
  --pretty
```

### `parse-manifest`

```bash
UV_BIN=$(sh ../scripts/ensure-uv.sh)
"$UV_BIN" run --project . python -m parser.cli parse-manifest \
  --manifest examples/mock_documents.json \
  --limit 5 \
  --pretty
```

지원 manifest 형식:

- JSON array
- JSONL
- `{ "records": [...] }`
- `{ "filings": [...] }`
- `{ "items": [...] }`

각 레코드는 아래 둘 중 하나를 가져야 합니다.

- 파일 경로 필드
  `local_path`, `file_path`, `path`, `report_local_path`
- 또는 원문 필드
  `content`

### `run`

```bash
UV_BIN=$(sh ../scripts/ensure-uv.sh)
"$UV_BIN" run --project . python -m parser.cli run \
  --adapter mock \
  --status ready_for_parse \
  --limit 10 \
  --pretty
```

## API

기본 주소:

- `http://localhost:3406`

### Health

```bash
curl -s http://localhost:3406/health
```

`/health` 응답에는 `jobStore`와 `runtimeStore`가 포함됩니다. `runtimeStore`
는 SQLite runtime DB 경로와 thread/run count를 보여 주므로 LangGraph-style
runtime state가 어느 파일에 쌓이는지 확인할 수 있습니다.

### Parser API

```bash
curl -s -X POST http://localhost:3406/api/parser/init-neo4j \
  -H 'content-type: application/json' \
  -d '{"pretty": true}'

curl -s -X POST http://localhost:3406/api/parser/parse-manifest \
  -H 'content-type: application/json' \
  -d '{"manifest":"examples/mock_documents.json","limit":1,"pretty":true}'

curl -s -X POST http://localhost:3406/api/parser/run \
  -H 'content-type: application/json' \
  -d '{"adapter":"mock","status":"ready_for_parse","limit":1,"pretty":true}'
```

### Collector Parse Job Retention

`/api/parser/collector/parse-jobs` 상태는 process-local memory에 보관됩니다. 장시간
개발 서버나 smoke-test runner에서 완료된 job 결과가 계속 쌓이지 않도록 아래 설정으로
retention을 제한합니다.

Collector에서 다운로드된 실제 SEC filing을 parser/Neo4j로 넘길 때는
`parserStatus`로 아직 처리되지 않은 항목만 대상으로 제한합니다. 기본값은 빈
문자열이며, 성공 시 collector의 `parser_status`가 `parsed`로 갱신됩니다.

```bash
curl -s -X POST http://localhost:3406/api/parser/collector/parse-jobs \
  -H 'content-type: application/json' \
  -d '{"ticker":"AAPL","since":"2025-01-01","pageSize":1,"parserStatus":""}'
```

For an automated local smoke that covers SEC seed, parser write, Neo4j, and
Graph RAG retrieval in one command, run from the workspace root:

```bash
pnpm run test:graph-rag
```

The smoke uses `LLM_PROVIDER=mock` by default so it validates the integration
path deterministically without depending on an external model.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PARSER_JOB_STORE_MAX_JOBS` | `1000` | 완료된 job을 우선 제거해서 memory store 크기를 제한합니다. |
| `PARSER_JOB_STORE_TTL_SECONDS` | `86400` | 완료/실패 job 상태를 마지막 업데이트 후 최대 24시간 보존합니다. |

실행 중인 job은 retention 정리 대상에서 제외됩니다. 오래된 완료 job을 조회하면
`404 job not found`가 정상 응답일 수 있으므로, 운영 로그의 `correlationId`를 함께
보관하세요.

### Runtime Persistence

LangGraph-style runtime thread/run state는 SQLite에 저장됩니다. 기본 경로는
`3-10-k-parser/data/runtime.db`이며, `RUNTIME_DB_PATH`로 바꿀 수 있습니다. 상대
경로 값은 현재 shell 위치가 아니라 `3-10-k-parser` 패키지 루트를 기준으로
해석됩니다.

| Variable | Default | Purpose |
| --- | --- | --- |
| `RUNTIME_DB_PATH` | `./data/runtime.db` | Runtime thread/run SQLite state path |
| `RUNTIME_STORE_MAX_THREADS` | `500` | Maximum runtime threads retained in SQLite |
| `RUNTIME_STORE_RETENTION_DAYS` | `30` | Runtime threads older than this are evicted with their runs |
| `PARSER_BACKEND_BASE_URL` | `http://localhost:3406` | Parser runtime self/base URL for local API references |
| `MOCK_DOCUMENTS_PATH` | `./examples/mock_documents.json` | Mock collector input used by local parser runs |

Retention cleanup removes the oldest `runtime_thread` rows first and deletes
their related `runtime_run` rows with them. Active conversations update the
thread `updated_at` timestamp during each stream run, so recent user work remains
favored over stale local sessions. The SQLite schema enforces
`runtime_run.thread_id -> runtime_thread.thread_id` with `ON DELETE CASCADE` and
keeps indexes on `runtime_run(thread_id, created_at)` and
`runtime_thread(updated_at, thread_id)` for cleanup and stream-resume paths.

### LangGraph-style Runtime API

thread 생성:

```bash
curl -s -X POST http://localhost:3406/api/langgraph/threads \
  -H 'content-type: application/json' \
  -d '{"assistantId":"sec_filing_assistant_v1"}'
```

run stream:

```bash
curl -N -X POST http://localhost:3406/api/langgraph/threads/<thread-id>/runs/stream \
  -H 'content-type: application/json' \
  -d '{
    "chatId":"<thread-id>",
    "userId":"demo-user",
    "message":"Sample Technology risks 알려줘"
  }'
```

snapshot:

```bash
curl -s http://localhost:3406/api/langgraph/threads/<thread-id>/snapshot
```

latest stream resume:

```bash
curl -N http://localhost:3406/api/langgraph/threads/<thread-id>/stream
```

## Retrieval

현재 retrieval은 `scope-light Neo4j retrieval`입니다.

- 질문에서 intent를 분류합니다.
  `risk`, `metric`, `compare`, `brief`, `summary`
- 선택된 filing이 있으면 filing scope를 우선 적용합니다.
- intent별 Cypher로 evidence를 가져옵니다.
- 결과는 `evidence_bundle`과 `selected_filing`으로 정리됩니다.
- runtime stream에서는 다음 custom event를 함께 보냅니다.
  - `data-retrieval-debug`
  - `data-selected-filing`

## LLM Provider

현재 기본 extractor provider는 `codex-cli`입니다.

- `.env`
  - `LLM_PROVIDER=codex-cli`
  - `CODEX_CLI_PATH=codex`
  - `CODEX_PROFILE=`
  - `CODEX_SANDBOX=read-only`

engine 선택은 `src/parser/llm/extractor.py`의 `build_extraction_engine()`에서 결정됩니다.

- `openai` -> `OpenAIExtractionEngine`
- `codex-cli` -> `CodexCLIExtractionEngine`
- 그 외 -> `MockExtractionEngine`

## Validation

현재 공식 검증 범위는 parser-only API E2E입니다.

대상:

- `POST /api/parser/init-neo4j`
- `POST /api/parser/parse-manifest`
- `POST /api/langgraph/threads`
- `POST /api/langgraph/threads/{threadId}/runs/stream`
- `GET /api/langgraph/threads/{threadId}/snapshot`
- `GET /api/langgraph/threads/{threadId}/stream`

실행:

```bash
pnpm --filter @10k/parser run test:unit

cd 3-10-k-parser/bruno-api-tests
bru run setup --env local --env-var baseUrl=http://127.0.0.1:3406
bru run langgraph --env local --env-var baseUrl=http://127.0.0.1:3406
```

`test:unit` compiles the parser package and runs
`scripts/runtime_store_smoke.py`, which verifies runtime SQLite fresh-schema
creation, legacy table migration, orphan run removal, indexes, and
`ON DELETE CASCADE`.

검증 리포트:

- parser-only report: [../docs/parser-api-e2e-validation-report.md](../docs/parser-api-e2e-validation-report.md)

## 이번 작업에서 반영된 내용

- `GraphMapper`를 실제 graph projection 형태로 교체
- `FilingSegmenter`, `LLMExtractor`를 pipeline-compatible adapter로 정리
- parser 내부에 `retrieval` 계층 추가
- parser 내부에 `runtime store` 추가
- `/api/langgraph/*` 런타임 엔드포인트 추가
- `parse-manifest`의 relative path / content manifest 처리 보강
- Bruno parser API E2E 추가 및 안정화

## 참고 문서

- 구현 정리: [docs/implementation-summary.md](docs/implementation-summary.md)
- parser API validation report: [../docs/parser-api-e2e-validation-report.md](../docs/parser-api-e2e-validation-report.md)
- 운영 복구 runbook: [../docs/05-runbooks/operations.md](../docs/05-runbooks/operations.md)
