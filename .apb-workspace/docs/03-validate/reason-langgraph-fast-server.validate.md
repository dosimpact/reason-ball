# reason-langgraph-fast-server Validate

## Scope

- SSOT 10 tags, 63 HTTP operations, 57 component schemas.
- Assistants, Threads, Thread/Stateless Runs, Streaming, Crons, Store, A2A, MCP, System.
- PostgreSQL 8개 normalized metadata table과 `AsyncPostgresSaver` checkpointer 4개 table.
- `MAX_CONCURRENT_RUNS=10`, queued 10, overflow 429, same-thread 409.
- licensed LangGraph API image/CLI/Compose 제거와 기존 project extension 회귀.

## Validation Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| SSOT 63 operation 및 JSON-RPC/SSE 검증 | PASS | [Bruno log](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/bruno-api-tests/reports/2026-07-12-normalized-full.log): 68/68 requests, 67/67 tests, 105/105 assertions |
| Design implementation gap reviewed | PASS | [Gradate](../02-gradate/reason-langgraph-fast-server.gradate.md): 8/8, 100% |
| Unit/integration/regression test | PASS | [pytest log](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/reports/2026-07-12-postgres-pytest.log): 59 passed |
| Runtime OpenAPI ↔ SSOT | PASS | `test_standard_contract.py`; normalized diff 0 |
| Local/non-local migration policy | PASS | 최초/반복 local setup 및 non-local read-only/drift tests |
| Static validation | PASS | Ruff PASS; Pyright 0 errors |
| Validation evidence/report complete | PASS | 본 리포트에 scope/checklist/gap/E2E/skills/verdict 기록 |
| FAIL 또는 SKIP 없음 | PASS | 모든 critical item과 E2E scenario PASS |

## Gap Table

| Plan/Design Item | Implementation Evidence | Result |
| --- | --- | --- |
| SSOT 63 operation router | `tests/server/test_standard_contract.py` | Matched |
| 57 schema OpenAPI | `server/openapi_contract.py`; runtime diff 0 | Matched |
| PostgreSQL/checkpointer | `infrastructure/postgres/*`; real DB integration PASS | Matched |
| PostgreSQL metadata restart persistence | normalized repositories; Assistant/Thread restart probe PASS | Matched |
| Snapshot backfill과 destructive cutover guard | `snapshot_migration.py`; marker/count/ID/latest/checksum 및 drop guard | Matched |
| Legacy runtime 제거/checkpointer 보존 | bridge 제거; 실제 DB legacy=0, checkpointer=4 | Matched |
| ExecutionGate | `server/execution.py`; 10/10/429/409 tests | Matched |
| Assistant/Thread/Run APIs | domain routers; pytest/Bruno PASS | Matched |
| Cron/Store/A2A/MCP/System | extended routers; pytest/Bruno PASS | Matched |
| Licensed deployment removal | image/Compose/config/CLI dependency 제거 | Matched |

Overall Match Rate: **100% (10/10)**

## E2E Results

| Scenario | Tool | Result | Evidence |
| --- | --- | --- | --- |
| BRUNO-ASST-01..12 | Bruno | PASS | 15 Assistants lifecycle requests |
| BRUNO-MCP-01 | Bruno | PASS | initialize/notification contract |
| BRUNO-MCP-02 | Bruno | PASS | tools/list with 3 graphs |
| BRUNO-MCP-03 | Bruno + pytest | PASS | tools/call/concurrency |
| BRUNO-MCP-04 | pytest | PASS | invalid message/method/params errors |
| BRUNO-MCP-05 | Bruno | PASS | GET 405, DELETE 404 |
| BRUNO-THREAD-01 | Bruno | PASS | CRUD/search/count/copy/prune/delete |
| BRUNO-THREAD-02 | Bruno | PASS | state/checkpoint/history |
| BRUNO-RUN-01 | Bruno | PASS | thread run lifecycle |
| BRUNO-RUN-02 | Bruno | PASS | SSE stream/join/resume |
| BRUNO-RUN-03 | Bruno | PASS | stateless/batch/bulk cancel |
| BRUNO-STREAM-01 | Bruno | PASS | command/event SSE |
| BRUNO-CRON-01 | Bruno | PASS | 7 cron operations |
| BRUNO-STORE-01 | Bruno | PASS | item/namespace lifecycle |
| BRUNO-A2A-01 | Bruno | PASS | A2A task response |
| BRUNO-SYSTEM-01 | Bruno | PASS | info/metrics/docs/ok |
| OPENAPI-01 | pytest + jq diff | PASS | 63 operations, 57 schemas, 10 tags, diff 0 |
| INTEGRATION-CHECKPOINTER-01 | pytest + PostgreSQL | PASS | delete 후 checkpoint 복원 |
| INTEGRATION-METADATA-01..06 | pytest + PostgreSQL | PASS | backfill/멱등성/rollback/restart/cascade/drop guard |
| BRUNO-INFRA-01 | pytest + startup | PASS | local setup 최초/반복 성공 |
| BRUNO-INFRA-02 | pytest | PASS | non-local DDL 없음, drift fail-fast |

Full execution: **68/68 requests, 67/67 tests, 105/105 assertions PASS**.

PostgreSQL execution: **59/59 pytest PASS**. 실제 `.env` DB catalog는 normalized 8,
checkpointer 4, legacy 0이며 `/ok?check_db=1`이 PASS했다. 사전 backup은
`.tmp/reason-langgraph-fast-backup/pre-normalization-2026-07-12.dump`에 보관했다.

## Skill Usage Log

- `apb-pgv`: Plan → Gradate → Validate 상태 전환과 산출물 생성.
- `apb-gap-analysis`: design 8개 항목 ↔ implementation 비교, 100%.
- `apb-bruno-api-tests`: 12개 domain folder, operation별 request와 full run.
- `apb-validation-report`: evidence scoring과 최종 PASS 판정.
- Sub-agents: Assistants, Threads/Runs/Streaming, Extended API를 병렬 구현·검증.

## Action Items

- Blocking action item 없음.
- Non-blocking: LangGraph `create_react_agent` deprecation과 Starlette TestClient warning은 기존
  extension code의 후속 유지보수 항목으로 추적한다.

## Verdict

**PASS** — 모든 critical validation item과 E2E scenario가 PASS했고 설계↔구현 match rate가
100%이며 runtime OpenAPI diff가 0이다.
