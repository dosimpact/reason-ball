# 10-k-parser-migration Validate

## Scope

검증 대상은 `20-portfolio/1-reason-hwang/3-langgraph-fast`에 추가된 10-K/SEC filing
parser migration 구현이다.

검증 범위:

- 원본 `3-10-k-parser`를 삭제하지 않고 대상 패키지에 새 구현을 확장했는지.
- `segment -> extract -> map -> write -> retrieve` 흐름이 동작하는지.
- `dry_run` parsing이 Neo4j 없이 동작하는지.
- Neo4j infra가 올라온 상태에서 constraint init, graph write, query가 동작하는지.
- 기존 `/health`, `/graph/run` contract가 깨지지 않았는지.
- 신규 `/api/tenk/*`, `/graph/tenk/run` endpoint가 노출되고 API E2E가 통과하는지.
- package scripts가 fetch, dry-run parse, graph write, query 검증 흐름을 제공하는지.

검증 제외/조건부 범위:

- OpenAI/ChatGPT OAuth proxy 기반 structured extraction은 이번 migration pass에서
  의도적으로 제외했다. 기본 검증 경로는 `LLM_PROVIDER=mock`이다.

## Validation Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| 원본 `3-10-k-parser` 삭제 금지 | PASS | 원본 경로 변경 없음. 새 구현은 `20-portfolio/1-reason-hwang/3-langgraph-fast/src/langgraph_fast/*` 아래 추가 |
| Domain/infra/router/graph 경계 구현 | PASS | `domains/tenk`, `infrastructure/neo4j`, `server/routers/tenk.py`, `graph/tenk` 추가 |
| dry-run parser 검증 | PASS | `uv run python scripts/tenk_parse_dry_run.py --input tests/fixtures/tenk/sample_10k.txt --pretty` -> `segments=4`, `graph_nodes=36`, `graph_relationships=36` |
| 실제 AAPL 10-K fetch | PASS | `SEC_USER_AGENT=... pnpm run tenk:fetch` -> Apple Inc. 10-K, accession `0000320193-25-000079`, filing date `2025-10-31` |
| 실제 AAPL 10-K dry-run parse | PASS | `SEC_USER_AGENT=... pnpm run tenk:smoke` 중 dry-run -> `segments=23`, `graph_nodes=4261`, `graph_relationships=20028`, `written_nodes=0` |
| Unit/API/graph tests | PASS | `pnpm run test` -> 11 passed |
| Tenk-specific tests | PASS | `pnpm run test:tenk` -> 9 passed |
| Static analysis | PASS | `pnpm run lint` -> PASS; `pnpm run typecheck` -> 0 errors |
| Build | PASS | `pnpm run build` -> source distribution and wheel built |
| FastAPI route exposure | PASS | OpenAPI paths include `/api/tenk/init-neo4j`, `/api/tenk/parse-file`, `/api/tenk/parse-manifest`, `/api/tenk/query`, `/graph/tenk/run` |
| Bruno API E2E | PASS | `cd bruno-api-tests && bru run --env local` -> 2 requests passed, 5/5 assertions, 1/1 test |
| Neo4j infra status | PASS | `pnpm run infra-up:reason-hwang`, `pnpm run infra-ps:reason-hwang`; `graph-rag-neo4j` healthy |
| Neo4j constraints | PASS | `uv run python scripts/tenk_init_neo4j.py --pretty` -> `status=ok`, `constraints=9` |
| Graph write | PASS | `SEC_USER_AGENT=... pnpm run tenk:smoke` 중 write -> `written_nodes=4261`, `written_relationships=20028` |
| Retrieval query | PASS | `SEC_USER_AGENT=... pnpm run tenk:query` -> selected filing `acc:0000320193-25-000079`, intent `risk`, 8 evidence rows returned |
| End-to-end smoke script | PASS | `SEC_USER_AGENT=... pnpm run tenk:smoke` -> fetch, dry-run, init, write, query all passed |

## Gap Table

Overall Match Rate: 100%

| Plan/Design Item | Implementation Evidence | Result |
| --- | --- | --- |
| 원본 `3-10-k-parser` 삭제 금지 | 원본 경로는 수정하지 않고 대상 `3-langgraph-fast`에 새 파일 추가 | PASS |
| Domain boundary 추가 | `src/langgraph_fast/domains/tenk/*` | PASS |
| Infrastructure boundary 추가 | `src/langgraph_fast/infrastructure/neo4j/*` | PASS |
| FastAPI router 분리 | `src/langgraph_fast/server/routers/tenk.py`, `server.py` include_router | PASS |
| Existing `/graph/run` 유지 | 기존 `tests/test_app.py` 포함 전체 테스트 통과 | PASS |
| `segment -> extract -> map -> write -> retrieve` 흐름 | `pipeline.py`, `extractor.py`, `graph_mapper.py`, `writer.py`, `retrieval.py` | PASS |
| dry-run parse | `ParserPipeline(write_to_neo4j=False)`, `scripts/tenk_parse_dry_run.py` | PASS |
| Graph DB write | `Neo4jWriter.write_graph()`, `scripts/tenk_graph_write.py` | PASS |
| 조회 테스트 경로 | `RetrievalService.answer()`, `scripts/tenk_query.py`, `/api/tenk/query` | PASS |
| SEC fetch script | `scripts/tenk_fetch_report.py`, `package.json` `tenk:fetch` | PASS |
| package scripts | `20-portfolio/1-reason-hwang/3-langgraph-fast/package.json` | PASS |
| unit/static validation | `pnpm run test`, `pnpm run lint`, `pnpm run typecheck` 통과 | PASS |

## E2E Results

| Scenario | Tool | Result | Evidence |
| --- | --- | --- | --- |
| Health endpoint | Bruno | PASS | `cd bruno-api-tests && bru run --env local`: `/health` 200 OK |
| Parse file dry-run endpoint | Bruno | PASS | `cd bruno-api-tests && bru run --env local`: `/api/tenk/parse-file` 200 OK, `segments=4`, `written_nodes=0` |
| Domain dry-run parser | pytest + script | PASS | `pnpm run test:tenk:domain`; `tenk_parse_dry_run.py` returned graph counts |
| API router contract | pytest | PASS | `pnpm run test:tenk:api` -> 2 passed |
| LangGraph tenk workflow | pytest | PASS | `pnpm run test:tenk:graph` -> 1 passed |
| Neo4j write/query smoke | scripts + infra | PASS | `tenk_init_neo4j.py`, `tenk_graph_write.py`, `tenk_query.py` all succeeded after infra up |
| Real SEC fetch | SEC script | PASS | `tenk:fetch` fetched Apple Inc. 10-K accession `0000320193-25-000079` from SEC |
| Real SEC full smoke | package script | PASS | `SEC_USER_AGENT=... pnpm run tenk:smoke`: 23 segments, 4261 nodes, 20028 relationships, selected filing stayed on 10-K |

## Skill Usage Log

- `apb-pgv`: Used to transition plan -> gradate -> validate and manage PGV docs.
- `apb-unit-test-write`: Applied by adding focused pytest coverage for domain, API, graph workflow.
- `apb-static-analysis`: Applied by running `pnpm run lint` and `pnpm run typecheck`.
- `apb-gap-analysis`: Applied by comparing gradate design items to implementation evidence; match rate 100%.
- `apb-bruno-api-tests`: Applied by adding and running `bruno-api-tests` for health and parse dry-run API E2E.
- `apb-validation-report`: Applied by writing this validate report with checklist, gap table, E2E results, action items, and verdict.

## Action Items

- [ ] Implement structured external LLM extraction provider after parser/API parity is stable.
- [ ] Decide whether `/api/tenk/*` should remain or become `/api/sec-filings/*` before broader product integration.

## Verdict

PASS

Critical migration paths passed: implementation gap is 100%, unit/API/graph tests pass, lint/typecheck pass,
Bruno API E2E passes, real SEC fetch passes, and the full AAPL 10-K Neo4j graph write/query smoke passes.
