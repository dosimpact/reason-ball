# reason-langgraph-fast-server Plan

## Goal

`20-portfolio/1-reason-hwang/3-langgraph-fast/`를 라이선스가 필요한
`langchain/langgraph-api` image와 `langgraph dev` production 의존성 없이 실행되는 독립
FastAPI 서비스로 전환한다.

이번 feature의 공개 API 완료 목표는
[`langgraph-standard.json`](./langgraph-standard.json)에 정의된 10개 tag, 총 63개 HTTP operation을
요청, 응답, 오류, query/path/header parameter, OpenAPI/JSON-RPC/SSE 계약까지 구현하는 것이다.
P0는 핵심 graph 실행 surface, P1은 확장 surface로 나누되 P0와 P1 모두 완료 범위다.
P0/P1은 구현 순서 표시일 뿐이며 JSON 계약의 일부가 아니다.

## SSOT

- 유일한 API 계약 원본:
  `.apb-workspace/docs/01-plan/langgraph-standard.json`
- JSON의 `paths`, `components.schemas`, tag, request/response/status/header 계약을 직접 비교하며,
  사람이 재작성한 Markdown 명세를 계약 근거로 사용하지 않는다.
- 문서의 예시 base URL은 계약 식별자가 아니며 배포 환경마다 변경할 수 있다.
- endpoint, field, enum, required/default, status code 또는 error schema가 충돌하면 SSOT 문서를
  우선한다.
- 구현 과정에서 계약 변경이 필요하면 code보다 SSOT를 먼저 갱신한다.
- 삭제된 Markdown API 명세와 원격 배포 URL은 계약 근거로 사용하지 않는다.
- 승인된 단일 override: `DELETE /assistants/{assistant_id}?delete_threads=true`는 JSON 설명과 달리
  checkpointer의 checkpoint/write/blob row를 보존한다. 이 차이는 OpenAPI 구조가 아니라 내부
  cascade 동작 차이로 관리하고 별도 통합 테스트로 고정한다.

## Follow-up Implementation Status

- 정규화 repository 전환, snapshot backfill 검증, legacy 제거와 재검증을 완료했다.
- 최종 정규화 table 이름에는 `langgraph_fast_` prefix를 사용하지 않는다.
- `langgraph_fast_resources`와 `langgraph_fast_schema_version`은 migration 호환 코드와 이력에서
  legacy source를 정확히 지칭할 때만 이 이름을 사용하며 실제 DB에서는 제거됐다.
- 이 계획 확장 이전의 snapshot 기반 검증 결과는 baseline으로만 유지하고, 최종 판정은 정규화
  cutover 뒤 다시 수행한 Gradate/Validate 결과를 사용한다.

## Problem Statement

- `langgraph dev`는 개발용이며 production server로 사용하지 않는다.
- 현재 `Dockerfile.langgraph`, project Compose, package scripts가 라이선스 기반 LangGraph API
  배포 흐름에 결합되어 있다.
- 기존 FastAPI는 SSOT의 Assistants, Threads, Runs, Crons, Store, A2A, MCP, Streaming, System
  전체 계약을 제공하지 않는다.
- 기존 계획은 Assistants/MCP 15개 operation만 완료 범위로 잡아 63개 operation SSOT와 충돌했다.

## Scope

### In scope

1. 작업 대상은 `20-portfolio/1-reason-hwang/3-langgraph-fast/`다.
2. 라이선스 기반 배포 자산을 제거한다.
   - `Dockerfile.langgraph`
   - project 내부 `docker-compose.yml`
   - `langgraph.json`
   - `package.json`의 `studio`, `studio:dev`, `langgraph:*`, `docker:*`
   - `langgraph-cli[inmem]` dependency
   - Cloud license 및 제거된 배포 경로 관련 README/환경 변수
3. `src/server/server.py`를 FastAPI application/lifespan/public route 진입점으로 사용한다.
4. SSOT의 P0 핵심 API 50개를 모두 구현한다.
   - Assistants 12개
   - Threads 15개
   - Thread Runs 10개
   - Stateless Runs 4개
   - Streaming 2개
   - MCP 3개
   - System 4개
5. SSOT의 P1 확장 API 13개를 모두 구현한다.
   - Crons 7개
   - Store 5개
   - A2A 1개
6. Assistants API 12개를 구현한다.
   - `POST /assistants`
   - `POST /assistants/search`
   - `POST /assistants/count`
   - `GET /assistants/{assistant_id}`
   - `PATCH /assistants/{assistant_id}`
   - `DELETE /assistants/{assistant_id}`
   - `GET /assistants/{assistant_id}/graph`
   - `GET /assistants/{assistant_id}/subgraphs`
   - `GET /assistants/{assistant_id}/subgraphs/{namespace}`
   - `GET /assistants/{assistant_id}/schemas`
   - `POST /assistants/{assistant_id}/versions`
   - `POST /assistants/{assistant_id}/latest`
7. MCP HTTP operation 3개와 JSON-RPC/tool 계약을 구현한다.
   - `POST /mcp/` 및 redirect 없는 canonical client target `/mcp`
   - `GET /mcp/` → `405`
   - `DELETE /mcp/` → stateless session `404`
   - `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`
8. `main_graph`, `tenk_subgraph`, `starter_graph`를 graph registry와 MCP tool registry에 등록한다.
9. 모든 request/response model은 SSOT의 `components.schemas` 57개와 일치시킨다.
10. Assistant, thread, run, cron, store metadata/version/latest 상태는 infra Compose의
    PostgreSQL 정규화 테이블에 resource별 row로 저장한다.
    - `assistants`
    - `assistant_versions`
    - `threads`
    - `runs`
    - `crons`
    - `store_items`
    - `a2a_tasks`
    - `schema_migrations`
    - 사용자가 제시한 목록에는 Thread가 빠져 있으나 `/threads/search`, `/threads/count`와
      checkpoint가 없는 Thread의 재시작 영속성을 위해 `threads`가 필수다.
    - A2A `tasks/get` 상태의 재시작 영속성을 위해 `a2a_tasks`도 포함한다.
11. 현재 `langgraph_fast_resources(kind='runtime', resource_id='snapshot')` JSONB snapshot은
    임시 호환 계층으로 간주하고 정규화 repository 전환과 데이터 검증 후 제거한다. 정규화
    migration 전에 이 table/row를 삭제하면 Assistant/Thread/Run 등의 재시작 영속성이 사라지므로
    선삭제를 금지한다.
12. `langgraph-checkpoint-postgres`의 `AsyncPostgresSaver`를 graph compile/runtime 기반으로
    연결한다.
13. 기존 `/health`, `/graph/run`, 10-K API는 회귀 호환을 유지하되 SSOT contract comparison에서
    extension route로 제외한다.
14. thread/stateless/cron/A2A/MCP 및 기존 graph 실행에는 `MAX_CONCURRENT_RUNS=10` 정책을 적용한다.
    - active 10개
    - FIFO queued 10개
    - 21번째부터 `429` + `Retry-After`
    - 동일 thread 중복은 `409`
    - 단일 Uvicorn worker

### Out of scope

- Cloud/Control Plane API와 LangSmith 인증
- Redis 기반 분산 queue와 다중 worker coordination
- OpenAPI 3.1로 표현되지 않은 WebSocket protocol 세부 계약

WebSocket은 SSOT tag 설명에만 언급되고 path/operation/schema 계약이 없으므로 HTTP/SSE 63개
operation 완료 범위와 분리한다.

## Directory Structure

```text
20-portfolio/1-reason-hwang/3-langgraph-fast/
├── .env.example                                      [update]
├── README.md                                         [update]
├── package.json                                      [update]
├── pyproject.toml                                    [update]
├── uv.lock                                           [update]
├── bruno-api-tests/
│   ├── 01-system/                                    [keep/update]
│   ├── 02-parser/                                    [keep]
│   ├── 03-assistants/                                [new]
│   │   ├── create-assistant.bru
│   │   ├── search-assistants.bru
│   │   ├── count-assistants.bru
│   │   ├── get-assistant.bru
│   │   ├── patch-assistant.bru
│   │   ├── get-assistant-graph.bru
│   │   ├── get-assistant-subgraphs.bru
│   │   ├── get-assistant-subgraph-namespace.bru
│   │   ├── get-assistant-schemas.bru
│   │   ├── get-assistant-versions.bru
│   │   ├── set-latest-assistant-version.bru
│   │   └── delete-assistant.bru
│   ├── 04-mcp/                                       [new]
│   │   ├── initialize.bru
│   │   ├── initialized-notification.bru
│   │   ├── ping.bru
│   │   ├── list-tools.bru
│   │   ├── call-tool.bru
│   │   └── method-errors.bru
│   ├── 05-threads/                                   [new]
│   ├── 06-thread-runs/                               [new]
│   ├── 07-stateless-runs/                            [new]
│   ├── 08-streaming/                                 [new]
│   ├── 09-crons/                                     [new]
│   ├── 10-store/                                     [new]
│   ├── 11-a2a/                                       [new]
│   ├── 12-system/                                    [new]
│   ├── 99-cleanup/                                   [new]
│   └── reports/                                      [generated, gitignored]
├── scripts/                                          [keep: 10-K scripts]
├── src/
│   ├── settings.py                                   [update]
│   ├── domains/                                      [keep]
│   ├── graph/                                        [keep/update registry inputs]
│   ├── infrastructure/
│   │   ├── neo4j/                                   [keep]
│   │   └── postgres/                                 [new]
│   │       ├── __init__.py
│   │       ├── checkpointer.py
│   │       ├── migrations.py
│   │       ├── snapshot_migration.py
│   │       ├── assistant_repository.py
│   │       ├── thread_repository.py
│   │       ├── run_repository.py
│   │       ├── cron_repository.py
│   │       ├── store_repository.py
│   │       └── a2a_task_repository.py
│   └── server/
│       ├── server.py                                 [update]
│       ├── assistants/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   ├── graph_registry.py
│       │   └── service.py
│       ├── mcp/
│       │   ├── __init__.py
│       │   └── server.py
│       ├── threads/                                  [new]
│       ├── runs/                                     [new]
│       ├── crons/                                    [new]
│       ├── store/                                    [new]
│       ├── a2a/                                      [new]
│       ├── streaming/                                [new]
│       ├── system/                                   [new]
│       └── routers/
│           └── tenk.py                               [keep]
└── tests/
    ├── test_app.py                                   [update]
    ├── server/
    │   ├── test_assistants_api.py
    │   ├── test_assistant_models.py
    │   ├── test_assistant_versions.py
    │   ├── test_mcp_api.py
    │   ├── test_threads_api.py
    │   ├── test_thread_runs_api.py
    │   ├── test_stateless_runs_api.py
    │   ├── test_streaming_api.py
    │   ├── test_crons_api.py
    │   ├── test_store_api.py
    │   ├── test_a2a_api.py
    │   ├── test_system_api.py
    │   └── test_tenk_api.py                          [keep]
    └── integration/
        ├── test_assistant_repository.py
        ├── test_assistant_delete_checkpoint_retention.py
        ├── test_postgres_checkpointer.py
        ├── test_normalized_metadata_repositories.py
        └── test_snapshot_to_normalized_migration.py
```

삭제 대상:

```text
3-langgraph-fast/
├── Dockerfile.langgraph                              [delete]
├── docker-compose.yml                                [delete]
└── langgraph.json                                    [delete]
```

외부 PostgreSQL:

```text
20-portfolio/1-reason-hwang/infra/1-infra-graph-rag/
├── .env
└── docker-compose.yml
    └── services.postgres
```

## Implementation Plan

### 1. 계약 고정

- SSOT의 63개 operation과 57개 component schema를 test case ID로 매핑한다.
- SSOT 자체의 unusual contract(`/versions` body 미연결, operation ID/path 불일치, 선언되지 않은
  일부 error response, open object schema)를 임의로 보정하지 않는다.
- 서버의 `/openapi.json`을 정규화한 뒤 SSOT의 paths/components/tags와 자동 비교한다.
- operation 수를 tag별로 고정한다: Assistants 12, Threads 15, Thread Runs 10, Crons 7,
  Store 5, System 4, Stateless Runs 4, MCP 3, Streaming 2, A2A 1.

### 2. 배포 의존성 제거

- 라이선스 image, project Compose, LangGraph CLI production scripts와 dependency를 제거한다.
- `pnpm dev/start`와 `uv run uvicorn server.server:app` 기반 실행으로 문서를 갱신한다.

### 3. 환경 설정과 PostgreSQL 연결

- API `.env`에서 다음 필수 값을 읽는다.
  - `ENV_PROFILE`
  - `POSTGRES_HOST`
  - `POSTGRES_PORT`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
  - `MAX_CONCURRENT_RUNS=10`
- psycopg conninfo builder로 DSN을 만들고 password/DSN을 log에 출력하지 않는다.
- 누락, 빈 값, placeholder `your`, 잘못된 port/profile은 DB 연결 전에 fail-fast한다.

### 4. Profile별 migration 정책

- `ENV_PROFILE`은 `local`, `dev`, `staging`, `production`만 허용하며 기본값을 두지 않는다.
- `local`에서만 `AsyncPostgresSaver.setup()`과 application metadata migration을 실행한다.
- non-local은 DDL을 실행하지 않고 table/migration version을 read-only 확인한다.
- non-local schema가 없거나 오래되면 startup을 중단한다.
- local DB role은 `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` 권한을 가진다.
- non-local runtime role은 DML/sequence 권한만 사용한다.

### 5. Graph registry와 schema introspection

- `main_graph`, `tenk_subgraph`, `starter_graph`를 고정 graph ID로 등록한다.
- graph, subgraphs, namespace subgraph, input/output/state/config/context schema를 registry에서
  생성한다.
- `/graph`의 `xray`, `/subgraphs`의 `recurse` query 의미를 SSOT와 일치시킨다.

### 6. Assistant persistence와 versioning

- Assistant UUID, graph ID, config, context, metadata, name, description, timestamps를 저장한다.
- create 시 version 1과 latest pointer를 생성한다.
- PATCH는 새 version을 만들고 metadata merge semantics를 적용한다.
- `/versions`는 SSOT대로 body 없는 POST를 기본 계약으로 구현한다.
- `/latest?version=`은 지정 version을 latest로 전환한다.
- delete의 `delete_threads` query를 수용하되 checkpointer의 checkpoint/write/blob row는 항상
  보존한다. `delete_threads=true`이면 정규화된 Thread/Run application metadata만 cascade
  삭제하고 Assistant와 version/latest metadata를 삭제한다.

### 7. Assistants API 12개 구현

- request validation, enum, defaults, limit/offset, sorting, select projection을 Pydantic으로
  구현한다.
- success status/body와 404/409/422 `ErrorResponse`를 SSOT와 일치시킨다.
- graph ID와 Assistant UUID 사용 가능 범위 차이를 endpoint별로 적용한다.
- SSOT가 open object로 둔 config/context/graph payload는 unknown field를 허용한다.

### 8. Threads, Runs, Streaming API 구현

- thread CRUD/search/count/prune/copy와 state/history/checkpoint 계약을 구현한다.
- thread run 10개와 stateless run 4개를 동일 execution service 및 PostgreSQL persistence에
  연결한다.
- stream/join/wait는 SSOT의 content type, SSE event, disconnect/cancel semantics를 따른다.
- thread command/event HTTP streaming 2개 operation을 구현한다.
- checkpointer의 `thread_id`, `checkpoint_ns`, `checkpoint_id`를 Standard API identifier와
  일관되게 매핑한다.

### 9. Crons, Store, A2A 구현

- cron create/search/count/get/patch/delete와 thread-scoped cron을 구현한다.
- cron scheduler는 단일 worker lifecycle에 결합하고 동일 execution concurrency gate를 사용한다.
- Store items PUT/GET/DELETE/search와 namespace listing을 PostgreSQL에 영속화한다.
- A2A endpoint는 assistant registry와 graph execution service를 재사용한다.

### 10. PostgreSQL metadata 정규화와 snapshot 제거

#### 10.1 정규화 schema

- `assistants`: Assistant 현재 identity, `latest_version`, graph/name/description,
  config/context/metadata JSONB, created/updated timestamp를 저장한다.
- `assistant_versions`: `(assistant_id, version)` primary key로 불변 version payload와
  timestamp를 저장하고 Assistant 삭제 시 cascade한다.
- `threads`: Thread identity, status, metadata/config/values/interrupts/TTL JSONB와
  created/updated/state_updated timestamp를 저장한다.
- `runs`: Run identity, nullable `thread_id`, `assistant_id`, status, metadata/kwargs/result,
  multitask strategy와 timestamp를 저장한다. Thread 삭제 시 application Run row만 cascade한다.
- `crons`: Cron identity, thread/assistant reference, schedule/timezone/enabled/payload,
  next/end time과 metadata를 저장한다.
- `store_items`: `(namespace, key)` primary key, value/index/TTL/expires_at과 timestamp를
  저장하며 namespace prefix/search용 index를 둔다.
- `a2a_tasks`: A2A task identity, Assistant/context/status/payload와 timestamp를 저장한다.
- `schema_migrations`: application metadata schema version과 적용 시각을 저장한다. 기존
  `langgraph_fast_schema_version`의 version을 이관한 뒤 legacy table을 제거한다.
- filter/search/count/sort/pagination에 사용되는 column과 JSONB metadata에는 필요한 B-tree/GIN
  index를 추가한다.
- LangGraph 표준 checkpointer 4개 table은 application FK/cascade 대상에 포함하지 않는다.

#### 10.2 Repository 전환

- 각 domain의 module-global dictionary 직접 접근을 PostgreSQL repository interface로 교체한다.
- request 단위 transaction에서 Assistant version/latest, Thread/Run status, Cron, Store mutation을
  원자적으로 처리한다.
- `/threads/search`와 `/threads/count`는 `threads` SQL query를 직접 사용하며
  checkpoint table을 Thread 목록 source로 사용하지 않는다.
- 별도 runtime storage mode를 두지 않는다. startup migration이 advisory lock과 단일 transaction
  안에서 backfill/검증을 마친 뒤 repository를 주입하므로 정상 요청은 항상 normalized table만
  읽고 쓴다.
- 다중 worker를 아직 지원하지 않더라도 process-local snapshot을 source of truth로 사용하지 않는다.

#### 10.3 Snapshot backfill과 cutover

1. 정규화 table/index/FK를 additive migration으로 먼저 생성한다.
2. `langgraph_fast_resources(kind='runtime', resource_id='snapshot')`를 read-only로 읽어 Assistant,
   versions/latest, Thread, Run, Cron, Store, A2A task row로 변환한다.
3. backfill은 단일 transaction과 migration version으로 멱등하게 실행하고 중단 후 재실행을
   지원한다.
4. 같은 transaction에서 resource별 row count, ID set, latest version, JSON payload checksum을
   비교하고 diff가 있으면 전체 rollback한다.
5. 검증 성공 marker를 기록한 뒤에만 `state_bridge.py`/snapshot write path를 사용하지 않는
   normalized repository를 주입한다.
6. 사전 backup이 확인되고 검증 marker가 존재할 때만 `langgraph_fast_resources`와
   `langgraph_fast_schema_version`을 제거한다. marker가 없으면 destructive migration은 거부한다.
7. legacy 제거 후 restart/read/search/count 및 전체 API E2E를 수행한다. rollback은 runtime mode
   전환이 아니라 사전 database backup 복원으로 수행한다.
8. 정규화 검증 완료 전 `langgraph_fast_resources`를 수동 삭제하거나 migration에서 먼저 drop하는
   것을 금지한다.

#### 10.4 삭제 및 보존 정책

- Assistant `delete_threads=false`: Assistant/version/latest만 삭제하고 Thread/Run과 checkpoint는
  유지한다.
- Assistant `delete_threads=true`: visible Thread와 해당 Run application row까지 삭제하지만
  `checkpoints`, `checkpoint_writes`, `checkpoint_blobs`는 항상 유지한다.
- Thread DELETE: Thread/Run application row를 삭제하되 checkpointer row 보존 정책은 동일하다.
- Store TTL cleanup과 Cron/A2A cleanup은 resource별 transaction으로 수행한다.

### 11. MCP Streamable HTTP

- 공식 MCP Python SDK를 사용해 stateless Streamable HTTP app을 FastAPI lifespan에 결합한다.
- OpenAPI에는 `/mcp/` POST/GET/DELETE를 노출하고 client 문서에는 redirect 없는 `/mcp`를
  canonical target으로 안내한다.
- `initialize`, initialized notification, `ping`, `tools/list`, `tools/call` 및 JSON-RPC 표준 오류를
  SSOT와 일치시킨다.
- 세 graph를 runtime `tools/list`의 tool/inputSchema로 노출하고 하드코딩된 client schema에
  의존하지 않는다.
- `tools/call`은 공통 graph 실행/concurrency gate를 사용하고 `content`, `structuredContent`,
  `isError`를 구분한다.

### 12. System API와 실행 동시성 유지

- `/info`, `/metrics`, `/docs`, `/ok`를 SSOT와 일치시킨다.
- thread/stateless/cron/A2A/MCP와 기존 graph 실행은 공통 concurrency gate를 통과한다.
- active 10 + queued 10 + overflow 429, 동일 thread 409 정책을 유지한다.
- metadata CRUD/introspection과 Store API는 graph execution slot을 소비하지 않는다.
- 단일 Uvicorn worker만 지원한다.

### 13. 문서와 테스트

- README에 infra PostgreSQL, `.env`, `--env-file`, profile별 migration, Bruno 실행 방법을 적는다.
- unit/integration test와 Bruno test를 모두 작성한다.
- 전체 63개 operation과 57개 schema의 OpenAPI snapshot diff를 Validate gate에 포함한다.
- snapshot → normalized backfill, transaction rollback, restart persistence, backup 복원 절차와 snapshot 제거를
  integration test와 운영 migration runbook으로 검증한다.

## Validate Execution Plan

### 사전 인프라

1. Docker Engine과 Compose v2가 실행 중이어야 한다.
2. infra `.env`에는 `VOLUME_PREFIX`, PostgreSQL credential/database/port가 있어야 한다.
3. PostgreSQL을 기동하고 readiness를 확인한다.

   ```sh
   cd 20-portfolio/1-reason-hwang/infra/1-infra-graph-rag
   docker compose --env-file .env up -d postgres
   docker compose --env-file .env exec -T postgres \
     sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   ```

4. API `.env`는 실제 PostgreSQL endpoint와 `ENV_PROFILE=local`,
   `MAX_CONCURRENT_RUNS=10`을 포함해야 한다.
5. project dependency를 설치하고 단일 worker로 서버를 시작한다.

   ```sh
   cd 20-portfolio/1-reason-hwang/3-langgraph-fast
   uv sync
   uv run uvicorn server.server:app --env-file .env \
     --host 127.0.0.1 --port 8000 --workers 1
   ```

6. `/ok?check_db=1` 또는 project health endpoint로 PostgreSQL readiness를 확인한다.
7. `@usebruno/cli`는 project devDependency로 고정하고 `pnpm exec bru`로 실행한다.

### Bruno collection

- SSOT의 63개 operation마다 success 또는 명세된 expected-error request를 작성한다.
- create conflict 409, unknown ID/graph 404, validation 422를 별도 검증한다.
- generated Assistant/thread/run/cron ID와 version/checkpoint를 collection variable로 전달한다.
- resource delete는 tag별 마지막에 실행하고 cleanup 후 조회 계약을 검증한다.
- MCP는 initialize → notification → ping → tools/list → tools/call 순서와 GET 405/DELETE 404를
  검증한다.
- SSE는 event type, ordering, terminal event와 content type을 검증한다.
- `.env` secret을 `.bru` 또는 report에 기록하지 않는다.

실행:

```sh
pnpm exec bru run bruno-api-tests --env local
```

결과:

```text
bruno-api-tests/reports/<timestamp>.log
bruno-api-tests/reports/<timestamp>.junit.xml
bruno-api-tests/reports/<timestamp>.html
```

## Verification

- Implementation scope:
  - SSOT의 P0 50개 + P1 13개, 총 63개 method/path가 모두 구현된다.
  - placeholder, `501`, 문서만 존재하는 endpoint가 없다.
  - 제거 대상 image/script/config 참조가 남지 않는다.
- Public interfaces:
  - SSOT의 Assistants, Threads, Thread Runs, Stateless Runs, Crons, Store, A2A, MCP, System,
    Streaming tag 전체
  - 기존 project extension `/health`, `/graph/run`, 10-K API
- External dependencies:
  - FastAPI/Uvicorn
  - LangGraph OSS
  - `langgraph-checkpoint-postgres`
  - psycopg async pool
  - 공식 MCP Python SDK
  - infra PostgreSQL 16
- Internal dependencies:
  - graph registry
  - Assistant/thread/run/cron/store repository와 scheduler/execution service
  - normalized metadata repositories와 snapshot backfill/cutover runner
  - existing graph workflows와 10-K router
- Risky areas:
  - `/versions` body가 OpenAPI에 연결되지 않은 상태를 임의로 보정하면 SSOT와 달라진다.
  - PATCH metadata merge와 latest pointer transaction이 원자적이어야 한다.
  - `delete_threads=true`에서도 checkpoint를 보존한다는 project 정책이 regression으로 깨지지
    않아야 한다.
  - graph/subgraph schema는 graph code 변경에 따라 drift할 수 있다.
  - SSE disconnect, join/wait, cancellation과 background cron의 race condition을 검증해야 한다.
  - 단일 worker scheduler 재시작 시 cron 중복 실행을 방지해야 한다.
  - local-only DDL guard와 non-local runtime 권한을 테스트해야 한다.
  - snapshot backfill 중 누락/중복/부분 commit이 발생하면 cutover를 중단해야 한다.
  - `dual_write`의 한쪽 write만 성공하면 transaction rollback하고 source 간 drift를 남기지 않아야
    한다.
  - `langgraph_fast_resources`를 정규화 검증 전에 삭제하면 재시작 metadata가 손실된다.
  - `threads`, `runs`, `crons`처럼 일반적인 table 이름은 application 전용 database 또는 명시적
    PostgreSQL schema에서 관리해 다른 서비스 table과 충돌하지 않게 한다.

## Acceptance Criteria

- SSOT의 10개 tag, 총 63개 operation이 모두 동작한다.
- request/response/error/status/query/path/OpenAPI schema가 SSOT와 일치한다.
- Bruno success/error 계약이 모두 PASS하고 SKIP이 없다.
- 전체 paths/components/tags OpenAPI diff가 0이다. 단, 승인된 checkpointer 보존 override는
  런타임 동작 예외 목록에 명시한다.
- Assistant create → search/count/get → patch/version/latest → graph/schema/subgraphs → delete 흐름이
  PostgreSQL을 사용해 완료된다.
- local migration은 멱등이고 non-local startup은 DDL을 실행하지 않는다.
- `delete_threads=true`로 Assistant를 삭제해도 기존 checkpointer row가 유지된다.
- MCP client가 initialize, tool discovery, graph tool call을 완료한다.
- thread state/history/checkpoint와 thread/stateless run의 sync/async/stream/cancel 흐름이 완료된다.
- cron scheduling, Store CRUD/search/namespace, A2A 호출과 System endpoint가 완료된다.
- Assistant/Version/Thread/Run/Cron/Store/A2A metadata가 각각 `assistants`,
  `assistant_versions`, `threads`, `runs`, `crons`, `store_items`, `a2a_tasks`에 row 단위로 저장된다.
- `/threads/search`와 `/threads/count`가 `threads` table query 결과를 사용하고 process-local
  snapshot에 의존하지 않는다.
- snapshot backfill을 반복 실행해도 중복 row가 없고 snapshot↔normalized ID/count/latest/checksum
  diff가 0이다.
- normalized repository 재시작 후 모든 resource lifecycle과 search/count 결과가
  유지된다.
- cutover 검증 marker와 backup 확인 전에는 legacy snapshot table을 삭제하지 않는다.
- 최종 destructive migration 후 `langgraph_fast_resources`, `langgraph_fast_schema_version`,
  `state_bridge.py`, snapshot middleware와 snapshot runtime code path가
  남아 있지 않는다.
- snapshot 제거 후에도 LangGraph `checkpoints`, `checkpoint_writes`, `checkpoint_blobs`,
  `checkpoint_migrations` table과 기존 checkpoint row는 유지된다.
- 기존 `/health`, `/graph/run`, 10-K 회귀 테스트가 통과한다.
- lint와 typecheck가 통과한다.

## Validation

- `apb-bruno-api-tests`로 SSOT의 63개 HTTP operation과 대표 JSON-RPC/SSE 오류를 검증한다.
- `apb-gap-analysis`로 SSOT ↔ 구현 gap을 계산한다.
- `apb-validation-report`에 Bruno 결과, OpenAPI diff, gap table, action items를 기록한다.
- PostgreSQL integration test로 normalized repository CRUD/search/count/transaction, backfill
  idempotency, transactional diff/rollback, restart persistence, backup 복원 절차와 legacy table 제거를 검증한다.
- endpoint 하나라도 FAIL/SKIP이거나 OpenAPI diff가 있으면 최종 verdict는 FAIL이다.

### E2E 시나리오

- `BRUNO-ASST-01`: valid graph로 Assistant를 생성하고 `Assistant` schema를 검증한다.
- `BRUNO-ASST-02`: 중복 ID의 `raise`/`do_nothing`과 409 계약을 검증한다.
- `BRUNO-ASST-03`: search filter, pagination, sorting, select projection을 검증한다.
- `BRUNO-ASST-04`: count가 동일 filter의 search 결과와 일치하는지 검증한다.
- `BRUNO-ASST-05`: get의 UUID/404 계약을 검증한다.
- `BRUNO-ASST-06`: PATCH가 metadata를 merge하고 새 version을 만드는지 검증한다.
- `BRUNO-ASST-07`: graph `xray`와 graph ID/Assistant ID lookup을 검증한다.
- `BRUNO-ASST-08`: subgraphs와 namespace/recurse 계약을 검증한다.
- `BRUNO-ASST-09`: schemas의 graph/input/output/state/config/context schema를 검증한다.
- `BRUNO-ASST-10`: versions body 없는 POST와 version list를 검증한다.
- `BRUNO-ASST-11`: latest query의 required integer와 latest 전환을 검증한다.
- `BRUNO-ASST-12`: delete/delete_threads와 삭제 후 404를 검증한다.
- `BRUNO-MCP-01`: initialize와 initialized notification의 200/202 계약을 검증한다.
- `BRUNO-MCP-02`: ping과 tools/list에서 세 graph tool/inputSchema를 검증한다.
- `BRUNO-MCP-03`: tools/call 성공/isError와 concurrency gate를 검증한다.
- `BRUNO-MCP-04`: parse/invalid request/method/params error code를 검증한다.
- `BRUNO-MCP-05`: GET 405와 stateless DELETE 404를 검증한다.
- `BRUNO-THREAD-01`: create/search/count/get/patch/copy/prune/delete lifecycle을 검증한다.
- `BRUNO-THREAD-02`: latest state, checkpoint state, update state와 history GET/POST를 검증한다.
- `BRUNO-RUN-01`: thread run create/list/get/wait/join/delete/cancel lifecycle을 검증한다.
- `BRUNO-RUN-02`: thread run stream과 기존 run stream 재연결의 SSE 계약을 검증한다.
- `BRUNO-RUN-03`: stateless run, wait, stream, batch와 bulk cancel을 검증한다.
- `BRUNO-STREAM-01`: thread command와 event stream의 SSE event ordering/terminal contract를
  검증한다.
- `BRUNO-CRON-01`: thread/stateless cron create/search/count/get/patch/delete와 실제 trigger를
  검증한다.
- `BRUNO-STORE-01`: item PUT/GET/search/DELETE와 namespace listing을 검증한다.
- `BRUNO-A2A-01`: 등록된 Assistant를 A2A endpoint로 호출하고 protocol response를 검증한다.
- `BRUNO-SYSTEM-01`: `/info`, `/metrics`, `/docs`, `/ok`의 status/content schema를 검증한다.
- `OPENAPI-01`: runtime OpenAPI를 정규화하여 SSOT의 63 operations, 57 schemas, 10 tags와 diff가
  0인지 검증한다.
- `INTEGRATION-CHECKPOINTER-01`: PostgreSQL에 Assistant 연관 checkpoint를 seed한 뒤
  `delete_threads=true`로 Assistant를 삭제하고 checkpoint/write/blob row가 그대로 남는지 DB에서
  검증한다.
- `INTEGRATION-METADATA-01`: snapshot fixture를 Assistant/Version/Thread/Run/Cron/Store/A2A
  정규화 table로 backfill하고 ID/count/latest/checksum diff 0을 검증한다.
- `INTEGRATION-METADATA-02`: backfill을 두 번 실행해도 row 수와 payload가 동일한지 검증한다.
- `INTEGRATION-METADATA-03`: backfill 검증 실패 시 marker와 normalized mutation이 함께
  rollback되고 legacy source가 유지되는지 검증한다.
- `INTEGRATION-METADATA-04`: normalized repository로 서버를 재시작한 뒤 resource lifecycle,
  `/threads/search`, `/threads/count`, Cron/Store/A2A 조회가 유지되는지 검증한다.
- `INTEGRATION-METADATA-05`: `delete_threads=true`와 Thread DELETE가 application metadata만
  cascade하고 checkpointer row를 유지하는지 검증한다.
- `INTEGRATION-METADATA-06`: 사전 custom-format backup이 존재하고, 검증 marker 없는 legacy drop은
  거부되며, 승인된 legacy table/state bridge 제거 뒤에도 전체 API E2E가 PASS하는지 검증한다.
- `BRUNO-INFRA-01`: local 최초/반복 startup migration과 readiness를 검증한다.
- `BRUNO-INFRA-02`: non-local schema drift에서 DDL 없이 fail-fast하는지 검증한다.

## Skills

### Gradate 단계

- apb-gap-analysis

### Validate 단계

- apb-bruno-api-tests
- apb-gap-analysis
- apb-validation-report
