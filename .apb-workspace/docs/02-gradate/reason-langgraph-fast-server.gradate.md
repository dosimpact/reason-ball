# reason-langgraph-fast-server Gradate

## Design

SSOT `01-plan/langgraph-standard.json`의 63개 HTTP operation을 FastAPI router로 분리 구현한다.
공개 OpenAPI는 SSOT를 그대로 반환하며, 실제 handler는 Assistant, Thread/Run, Store/Cron과
protocol adapter(MCP/A2A/SSE) 서비스에 위임한다. PostgreSQL은 production persistence와 LangGraph
checkpointer를 담당하고, 테스트에서는 동일 interface의 in-process repository를 사용한다. 기존
`langgraph_fast_resources` JSONB snapshot은 legacy migration source로만 읽은 뒤 resource별
정규화 table로 이관하고 제거한다.

## Implementation Draft

### Architecture Overview

`server.server:app`이 composition root다. Lifespan에서 환경 검증, PostgreSQL pool/checkpointer,
local-only migration을 초기화한다. Router는 domain service만 호출하며 execution 요청은 공통
`ExecutionGate(active=10, queued=10)`를 통과한다. metadata source of truth는 `assistants`,
`assistant_versions`, `threads`, `runs`, `crons`, `store_items`, `a2a_tasks`이며 process-local state는
실행 중 coordination/cache 용도로만 사용한다. 한 Uvicorn worker를 전제로 한다.

### Modules

| Module | Responsibility | Public Interface |
| --- | --- | --- |
| `server/server.py` | App/lifespan/router 조립, SSOT OpenAPI | `app` |
| `settings.py` | profile/PostgreSQL/concurrency 설정 검증 | `AppSettings.from_env()` |
| `infrastructure/postgres/checkpointer.py` | pool과 `AsyncPostgresSaver` lifecycle | `PostgresRuntime` |
| `infrastructure/postgres/migrations.py` | local DDL/non-local schema check | `prepare_schema()` |
| `infrastructure/postgres/snapshot_migration.py` | legacy snapshot backfill/검증/제거 | `run_snapshot_backfill()`, `drop_legacy_tables()` |
| `infrastructure/postgres/assistant_repository.py` | Assistant/version transaction | `PostgresAssistantRepository` |
| `infrastructure/postgres/thread_repository.py` | Thread CRUD/search/count | `PostgresThreadRepository` |
| `infrastructure/postgres/run_repository.py` | Run metadata lifecycle | `PostgresRunRepository` |
| `infrastructure/postgres/cron_repository.py` | Cron lifecycle/search/count | `PostgresCronRepository` |
| `infrastructure/postgres/store_repository.py` | Store item/namespace/TTL | `PostgresStoreRepository` |
| `infrastructure/postgres/a2a_task_repository.py` | A2A task persistence | `PostgresA2ATaskRepository` |
| `server/execution.py` | active/queue/thread 중복 제한 | `ExecutionGate.run()` |
| `server/assistants` | Assistant CRUD/version/schema | `router` |
| `server/threads` | Thread/state/history/checkpoint | `router` |
| `server/runs` | Thread/stateless run lifecycle | `router` |
| `server/streaming` | command/event SSE | `router` |
| `server/crons` | Cron lifecycle/scheduling metadata | `router` |
| `server/store` | Item/namespace persistence | `router` |
| `server/a2a` | Assistant A2A adapter | `router` |
| `server/mcp` | Stateless MCP Streamable HTTP | `router` |
| `server/system` | info/metrics/docs/ok | `router` |

### Interfaces

- HTTP: SSOT의 method/path/header/query/body/status/response schema를 그대로 사용한다.
- Persistence: repository interface는 async-compatible CRUD를 제공하며 PostgreSQL 구현과 test
  in-process 구현을 교체할 수 있다.
- Migration: local profile은 additive DDL → transactional snapshot backfill → checksum 검증 →
  normalized cutover를 수행한다. legacy drop은 검증 성공 뒤에만 허용한다.
- Naming: 최종 application table에는 `langgraph_fast_` prefix를 사용하지 않는다.
- Execution: `ExecutionGate.run(thread_id, awaitable)`은 active 10, queued 10, overflow 429,
  동일 thread active 409를 보장한다.
- Deletion override: `delete_threads=true`도 checkpoint/write/blob row는 삭제하지 않는다.
- OpenAPI: `/openapi.json`은 `langgraph-standard.json`을 반환하며 extension routes는 비교에서 제외한다.

### Dependencies

- Runtime: FastAPI, Uvicorn, Pydantic, LangGraph OSS.
- PostgreSQL: psycopg async pool, `langgraph-checkpoint-postgres`.
- Protocol: MCP Python SDK, SSE `StreamingResponse`.
- Validation: pytest, Bruno CLI, PGV gap analysis/validation report.

### Data Flow

1. Uvicorn lifespan이 환경 profile을 검증한다.
2. PostgreSQL pool을 열고 local이면 checkpointer/custom schema migration, non-local이면 read-only
   schema version 확인을 수행한다.
3. legacy snapshot이 있으면 단일 transaction에서 7개 resource table로 멱등 backfill하고
   ID/count/latest/checksum을 검증한다.
4. domain PostgreSQL repository를 router/runtime에 주입하고 normalized table을 read/write source로
   사용한다.
5. HTTP request를 tag router가 validation하고 repository/service에 전달한다.
6. 실행 request는 `ExecutionGate`를 거쳐 graph registry의 graph를 invoke/stream한다.
7. state/history/checkpoint는 checkpointer identifier로 영속화하며 application cascade와 분리한다.
8. 검증된 cutover 뒤 legacy state bridge/write path/table을 제거한다.
9. Validate에서 runtime OpenAPI, pytest, Bruno와 DB invariant를 증거로 수집한다.

## Gap Analysis (Pre-Validate)

Overall Match Rate: **100% (8/8)**

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| 정규화 DDL 8개 table/index/FK | `migrations.py`; 실제 DB `normalized=8` | Matched |
| Legacy snapshot backfill/멱등성/checksum | `snapshot_migration.py`; 실제 snapshot clone cutover와 PostgreSQL test | Matched |
| Assistant/Version PostgreSQL repository | `assistant_repository.py`; CRUD/version/latest 실제 PostgreSQL test | Matched |
| Thread/Run PostgreSQL repository | `thread_repository.py`, `run_repository.py`; search/count/restart/cascade test | Matched |
| Cron/Store/A2A PostgreSQL repository | resource별 repository; lifecycle/TTL/restart test | Matched |
| Checkpointer 보존 | state `aput` 조회와 Thread 삭제 후 checkpoint 보존 test | Matched |
| Legacy bridge/table 제거 | `state_bridge.py` 제거; 실제 DB `legacy=0`, `checkpointer=4` | Matched |
| 전체 API/OpenAPI/Bruno 회귀 | pytest 59, Ruff/Pyright PASS, Bruno 68/68, runtime diff 0 | Matched |

## Implementation Notes

- `delete_threads=true` checkpoint 보존은 SSOT description과 다른 승인된 project override다.
- P0/P1은 delivery order일 뿐 최종 acceptance에는 63개 operation이 모두 포함된다.
- WebSocket은 SSOT에 operation/schema가 없어 이번 구현의 HTTP/SSE 범위에서 제외한다.
- 기존 PostgreSQL JSONB snapshot 방식은 migration input일 뿐 최종 persistence로 사용하지 않는다.
- MCP request/tool schema는 공식 SDK의 `JSONRPCMessage`/`Tool` 모델로 검증·생성한다.
- 실제 local database를 생성하고 `AsyncPostgresSaver.setup()`의 최초/반복 migration을 검증했다.
- 이전 snapshot 구현의 검증 결과는 baseline으로만 사용하고 정규화 cutover 후 전부 재실행한다.
