# 10-k-parser-migration Plan

## 목표

기존 `3-10-k-parser` Python 백엔드를 `langgraph_fast` 프로젝트로
마이그레이션한다. 핵심 목표는 SEC filing 파싱 기능을 보존하면서, 대상
프로젝트의 FastAPI + LangGraph 패키지 구조에 맞게 책임 경계를 재정리하는
것이다.

마이그레이션 후 `langgraph_fast`는 10-K, 10-Q, 6-K, 20-F 같은 SEC 공시
문서를 구조화된 graph data로 파싱하고, parser/retrieval HTTP API를 제공하며,
파싱된 filing evidence를 기반으로 LangGraph workflow에서 grounded answer를
생성할 수 있어야 한다.

단, 기존 `langgraph_fast`의 graph starter 구조를 훼손하지 않고, 10-K parser
도메인을 별도 하위 패키지로 확장하는 방식으로 진행한다. 또한 원본
`3-10-k-parser` 코드는 삭제하지 않는다. 원본은 migration parity 확인, 동작 비교,
rollback 참조를 위한 기준 구현으로 남긴다.

## 범위

- 포함 범위:
  - 기존 parser core를
    `20-portfolio/2-harness-engineering-10-k/3-10-k-parser/src/parser`에서
    참고해
    `20-portfolio/1-reason-hwang/3-langgraph-fast/src/langgraph_fast` 하위에
    포팅하고 리팩터링한다.
  - 기존 핵심 흐름을 보존한다:
    `segment -> extract -> map -> write -> retrieve`.
  - `langgraph_fast` 내부에 10-K parsing domain boundary를 새로 만든다.
  - parser HTTP endpoint를 `langgraph_fast.server` 소유 FastAPI router로
    전환한다.
  - Neo4j 연동은 domain 내부가 아니라 infrastructure 계층으로 분리한다.
  - 기존 `langgraph_fast.graph.shared.provider`의 LLM provider 구조와 parser
    extractor provider 설정을 조정한다.
  - dry-run parsing, graph mapping, API route wiring, retrieval workflow를
    검증하는 집중 테스트를 추가한다.
- 제외 범위:
  - browser chat adapter UI.
  - collector service 자체 재구현.
  - 원본 `3-10-k-parser` 디렉터리 삭제 또는 정리.
  - 호환성 목적이 아닌 Neo4j graph model 변경.
  - background job orchestration의 production hardening.
  - 이미 Neo4j에 적재된 대규모 데이터 migration.

## 원본 코드 보존 원칙

- 이번 작업은 destructive migration이 아니다.
- `3-10-k-parser`는 제거하지 않고, `langgraph_fast` 쪽에 새 구현을 확장한다.
- 원본 코드는 다음 목적을 위해 유지한다:
  - 기존 동작과 새 구현의 parity 비교.
  - parser pipeline, Neo4j writer, retrieval query의 참조 구현.
  - migration 중 regression 발생 시 원인 추적.
  - 향후 필요 시 일부 기능을 다시 가져올 수 있는 backup source.
- 새 코드가 안정화되어도 원본 삭제는 이 feature의 완료 조건이 아니다.
- 원본 제거가 필요해지는 경우에는 별도 cleanup feature로 분리하고, 사용자가 명시적으로
  요청할 때만 진행한다.

## 제안 아키텍처

기존 디렉터리를 해치지 않고 다음처럼 확장한다.

```text
src/langgraph_fast/
  server/
    server.py
    routers/
      tenk_parser.py
      tenk_retrieval.py
  graph/
    workflow.py
    tenk/
      state.py
      workflow.py
      nodes.py
  domains/
    tenk/
      models.py
      segmenter.py
      extractor.py
      graph_mapper.py
      pipeline.py
      retrieval.py
  infrastructure/
    neo4j/
      writer.py
      constraints.py
    runtime/
      store.py
  settings.py
```

### 책임 경계

- `domains.tenk`
  - SEC filing domain logic을 담당한다.
  - document model, Item segmentation, extraction schema, graph projection,
    retrieval contract를 포함한다.
- `infrastructure.neo4j`
  - 외부 저장소 연동을 담당한다.
  - Neo4j driver setup, constraint initialization, graph upsert를 포함한다.
- `server.routers`
  - HTTP request/response model과 FastAPI route registration을 담당한다.
  - `server.py`는 app composition 역할만 유지한다.
- `graph.tenk`
  - 파싱된 filing evidence를 사용한 LangGraph workflow를 담당한다.
  - parser pipeline 자체를 LangGraph node로 만들지 않고, retrieval 기반
    question-answer workflow만 LangGraph에 연결한다.
- `settings.py`
  - LLM provider, Neo4j, parser chunk 설정, prompt 경로, runtime path 같은
    environment-backed 설정을 통합한다.

## 마이그레이션 매핑

| 현재 parser module | 대상 module | 메모 |
|---|---|---|
| `parser/core/models.py` | `langgraph_fast.domains.tenk.models` | 초기에는 dataclass contract를 유지한다. |
| `parser/segmenter.py` | `langgraph_fast.domains.tenk.segmenter` | Item/PART header 탐지와 chunking 동작을 보존한다. |
| `parser/llm/extractor.py` | `langgraph_fast.domains.tenk.extractor` | 기존 shared provider 계층과 설정 중복을 줄인다. |
| `parser/graph_mapper.py` | `langgraph_fast.domains.tenk.graph_mapper` | 기존 node/relationship schema를 보존한다. |
| `parser/core/pipeline.py` | `langgraph_fast.domains.tenk.pipeline` | concrete Neo4j writer 직접 생성 의존성을 제거한다. |
| `parser/storage/neo4j_writer.py` | `langgraph_fast.infrastructure.neo4j.writer` | persistence 구현은 domain 밖에 둔다. |
| `parser/retrieval/service.py` | `langgraph_fast.domains.tenk.retrieval` | Cypher/query behavior는 유지하되 driver setup은 숨긴다. |
| `parser/api/server.py` | `langgraph_fast.server.routers.*` | `server.py`를 키우지 않고 parser/retrieval router로 분리한다. |
| `parser/runtime/store.py` | `langgraph_fast.infrastructure.runtime.store` | LangGraph-style runtime endpoint가 계속 필요할 때만 유지한다. |
| `parser/cli.py` | 선택 사항: `langgraph_fast.tenk_cli` | API/domain migration 안정화 후 필요성을 판단한다. |

## 핵심 설계 결정

- parser pipeline은 domain service로 유지한다.
- LangGraph는 filing question-answer workflow에만 사용한다:
  `intent 탐지 -> evidence retrieval -> grounded answer 생성`.
- pipeline dependency는 주입 가능해야 한다:
  segmenter, extractor, mapper, graph repository/writer.
- `dry_run` parsing은 Neo4j 없이 동작해야 한다.
- API route는 CLI subprocess를 호출하지 않고 Python service를 직접 호출한다.
- 첫 구현은 동작 보존을 우선하고, extraction quality 개선이나 graph schema 변경은
  후속 작업으로 분리한다.

## 추가로 고민해야 할 포인트

### 1. 패키지 경계와 이름

`domains.tenk`가 10-K만 의미하는지, SEC filing 전체를 의미하는지 결정해야 한다.
현재 기존 parser는 10-K뿐 아니라 10-Q, 6-K, 20-F도 언급한다. 이름을
`domains.tenk`로 고정하면 의미가 좁아지고, `domains.sec_filings`로 가면 확장성은
좋지만 기존 feature 이름과 거리가 생긴다.

초기안은 `domains.tenk`를 사용하되, module docstring과 public API에서
"SEC filing parser"라는 의미를 명확히 적는 것이다.

### 2. 호환성 shim 유지 여부

기존 코드나 테스트가 `parser.*` import path를 사용하고 있을 수 있다. 한 번에 모든
import를 바꾸면 migration diff가 커진다.

선택지는 두 가지다.

- `parser.*` compatibility shim을 짧게 유지한다.
- 모든 import를 즉시 `langgraph_fast.*`로 바꾼다.

초기 migration에서는 shim을 최소화하거나 아예 만들지 않는 쪽이 좋다. 단, 기존 E2E나
Bruno test가 import path에 의존하면 짧은 deprecation shim을 둔다.

### 3. 설정 통합 방식

기존 parser는 `parser.core.config`를 사용하고, 대상 프로젝트는 provider별 설정을
`graph.shared.provider` 쪽에 갖고 있다. 이 둘을 그대로 합치면 LLM provider 설정이
중복된다.

결정해야 할 항목:

- `LLM_PROVIDER` 값 체계: `mock`, `openai`, `codex-cli`, `chatgpt-oauth-proxy`.
- prompt directory 기본 경로.
- Neo4j connection env 이름.
- parser chunk size와 overlap env 이름.
- 테스트에서 설정을 override하는 방식.

### 4. sync/async 경계

현재 parser pipeline은 대부분 sync 코드이고, FastAPI와 LangGraph는 async 흐름과
잘 맞는다. 무리하게 전체를 async로 바꾸면 migration 범위가 커진다.

초기에는 domain pipeline을 sync로 유지하고, API route에서 blocking 작업 처리 전략을
정해야 한다. 파일 파싱과 LLM extraction이 오래 걸릴 수 있으므로 추후 background job
또는 worker 분리가 필요할 수 있다.

### 5. Neo4j schema와 idempotency

graph writer는 upsert 성격이어야 하고, 같은 filing을 여러 번 파싱해도 중복 노드가
생기지 않아야 한다. 기존 key 생성 규칙을 유지할지, `Company`, `Filing`, `Item`,
`SectionText`의 unique key를 재정리할지 확인해야 한다.

검토 항목:

- constraint 이름과 label/key 정책.
- accession number가 없는 문서의 fallback key.
- 재파싱 시 기존 section/fact/risk 갱신 방식.
- write transaction 실패 시 partial write 처리.

### 6. extractor provider 전략

기존 parser extractor는 `mock`, `openai`, `codex-cli`를 지원한다. 대상 프로젝트에는
OpenAI와 ChatGPT OAuth proxy provider가 있다. provider가 둘로 갈라지면 테스트와 운영
설정이 복잡해진다.

초기 전략은 다음이 좋다.

- unit test와 dry-run은 `mock` extractor를 기본값으로 둔다.
- production-like 실행에서만 외부 LLM provider를 사용한다.
- prompt rendering과 structured JSON validation은 provider와 분리한다.

### 7. prompt와 output schema의 소유권

LLM prompt는 domain asset에 가깝다. prompt를 `graph` 밑에 두면 parser domain이
graph 계층에 의존하게 된다.

후보 위치:

- `src/langgraph_fast/domains/tenk/prompts/`
- `assets/prompts/tenk/`

초기 migration에서는 domain 내부 prompts가 가장 단순하다. 다만 여러 domain이 같은
prompt asset을 공유하게 되면 `assets/`로 이동한다.

### 8. API versioning과 route naming

`/api/tenk/*`는 간결하지만 10-Q, 6-K, 20-F까지 다루는 서비스명으로는 좁을 수 있다.
`/api/sec-filings/*`가 더 정확할 수 있다.

결정 기준:

- 사용자가 이 기능을 "10-K parser"로 인식하면 `/api/tenk/*`.
- 제품 관점에서 SEC filing 전체를 다루려면 `/api/sec-filings/*`.

초기 plan은 feature 이름에 맞춰 `/api/tenk/*`를 유지하되, route prefix는 gradate에서
최종 결정한다.

### 9. runtime API 중복

기존 parser에는 LangGraph-style runtime API와 runtime store가 있다. 대상 프로젝트는
이미 LangGraph 자체를 품고 있으므로, 기존 runtime endpoint를 그대로 옮기면 개념이
겹칠 수 있다.

검토해야 할 질문:

- thread/run/snapshot API가 실제 사용자 workflow에 필요한가?
- 아니면 `graph.tenk.workflow`의 실행 결과만으로 충분한가?
- runtime store가 SQLite로 남아야 하는가?

초기 migration에서는 runtime store를 선택 사항으로 두고, parser/retrieval API parity가
확인된 뒤 유지 여부를 결정한다.

### 10. 테스트 fixture와 sample filing

migration 품질은 real-ish sample에 크게 좌우된다. 너무 작은 fixture만 쓰면 Item
분리, metric/risk 추출, graph mapping 문제가 드러나지 않는다.

필요한 fixture:

- `Item 1A`, `Item 7`, `Item 8`이 포함된 작은 synthetic filing.
- HTML filing normalization fixture.
- accession number가 있는 record와 없는 record.
- 동일 filing을 두 번 write하는 idempotency fixture.

### 11. 관측성과 에러 모델

parser는 파일, LLM, Neo4j, retrieval이 모두 얽히므로 실패 원인이 다양하다. API 응답과
log에 request id, document id, stage, provider, retry 가능 여부가 드러나야 한다.

초기부터 최소한 다음은 정해야 한다.

- parse stage별 error code.
- `include_debug` 응답 범위.
- LLM fallback 발생 시 사용자에게 보여줄지 여부.
- Neo4j 연결 실패와 graph write 실패의 HTTP status 구분.

### 12. 성능과 큰 문서 처리

SEC filing은 커질 수 있다. 현재 chunking은 character 기반 sliding window이다.
migration 과정에서 behavior를 유지하되, 아래 리스크를 기록해야 한다.

- 큰 filing에서 LLM call 수가 급증할 수 있다.
- API request timeout 안에 파싱이 끝나지 않을 수 있다.
- chunk overlap이 graph 중복을 늘릴 수 있다.
- background job 전환 시 job status store가 필요하다.

## 공개 인터페이스

마이그레이션된 Python-level contract는 다음을 목표로 한다.

```python
ParserPipeline.parse_file(path, metadata=None, include_debug=False) -> dict
ParserPipeline.parse_manifest(records, limit=None, dry_run=False) -> dict
RetrievalService.retrieve(query, selected_filing=None, **filters) -> RetrievalResult
RetrievalService.answer(query, selected_filing=None, **filters) -> tuple[str, RetrievalResult]
```

마이그레이션된 HTTP surface는 다음을 목표로 한다.

- `GET /health`
- `POST /api/tenk/init-neo4j`
- `POST /api/tenk/parse-file`
- `POST /api/tenk/parse-manifest`
- `POST /api/tenk/query`
- `POST /graph/tenk/run`

기존 starter endpoint인 `POST /graph/run`은 호환성을 유지해야 한다.

## 구현 단계

1. Domain extraction
   - models, segmenter, extractor, mapper, pipeline을
     `langgraph_fast.domains.tenk`에 새로 포팅한다.
   - import 변경 외의 behavior 변경은 최소화한다.
2. Infrastructure extraction
   - Neo4j writer와 constraints를 `langgraph_fast.infrastructure.neo4j`로
     포팅한다.
   - pipeline에는 writer/repository를 주입한다.
3. API integration
   - `server.routers.tenk_parser`와 `server.routers.tenk_retrieval`을 추가한다.
   - `server.py`는 app composition만 담당하게 유지한다.
4. LangGraph integration
   - `graph.tenk.workflow`를 추가해 retrieval-grounded answer workflow를 만든다.
   - 기존 minimal graph workflow는 유지한다.
5. Compatibility cleanup
   - CLI shim 유지 여부를 결정한다.
   - README와 tests를 API parity 확인 후 정리한다.

## package.json scripts 제안

대상 프로젝트의 현재 `package.json`은 `uv` 기반 script를 사용한다. migration 후에도
같은 방식을 유지한다. 사용자가 직접 확인하고 싶은 주요 동작은 다음 5단계다.

1. 서버 실행.
2. 10-K report 하나 fetch.
3. Graph DB에 넣기 전 parser dry-run 검증.
4. Graph DB write 검증.
5. Graph DB 기반 조회 검증.

### 사용자 확인용 핵심 scripts

```json
{
  "dev": "uv run uvicorn langgraph_fast.server.server:app --reload",
  "tenk:fetch": "uv run python scripts/tenk_fetch_report.py --ticker AAPL --form 10-K --output .tmp/tenk/latest-10k.txt --metadata-output .tmp/tenk/latest-10k.json",
  "tenk:parse:dry-run": "uv run python scripts/tenk_parse_dry_run.py --input .tmp/tenk/latest-10k.txt --metadata .tmp/tenk/latest-10k.json --pretty",
  "tenk:init-neo4j": "uv run python scripts/tenk_init_neo4j.py --pretty",
  "tenk:graph:write": "uv run python scripts/tenk_graph_write.py --input .tmp/tenk/latest-10k.txt --metadata .tmp/tenk/latest-10k.json --pretty",
  "tenk:query": "uv run python scripts/tenk_query.py --query \"What are the main risks?\" --metadata .tmp/tenk/latest-10k.json --pretty",
  "tenk:smoke": "pnpm run tenk:fetch && pnpm run tenk:parse:dry-run && pnpm run tenk:graph:write && pnpm run tenk:query"
}
```

목적:

- `dev`: 기존 server up script를 유지한다.
- `tenk:fetch`: SEC에서 10-K filing 하나를 가져와 `.tmp/tenk/latest-10k.txt`와
  metadata JSON을 만든다.
- `tenk:parse:dry-run`: Neo4j 없이 segment/extract/map 결과를 확인한다.
- `tenk:init-neo4j`: graph write 전에 constraints를 초기화한다.
- `tenk:graph:write`: 같은 input을 Neo4j에 upsert한다.
- `tenk:query`: 방금 적재한 filing graph를 대상으로 retrieval query를 실행한다.
- `tenk:smoke`: fetch부터 query까지 한 번에 실행하는 happy-path smoke command다.

`tenk:fetch`는 SEC 요청 정책 때문에 `SEC_USER_AGENT` env를 요구해야 한다.
예: `SEC_USER_AGENT="name email@example.com" pnpm run tenk:fetch`.

### HTTP 기반 확인 scripts

서버를 띄운 상태에서 HTTP contract를 검증하려면 다음 script를 추가한다.

```json
{
  "smoke:health": "uv run python scripts/smoke_health.py",
  "smoke:graph": "uv run python scripts/smoke_graph_run.py",
  "smoke:tenk:http": "uv run python scripts/smoke_tenk_api.py --input .tmp/tenk/latest-10k.txt --metadata .tmp/tenk/latest-10k.json"
}
```

목적:

- `smoke:health`: `GET /health` 확인.
- `smoke:graph`: 기존 `POST /graph/run` 호환성 확인.
- `smoke:tenk:http`: `POST /api/tenk/parse-file`, `POST /api/tenk/query`,
  `POST /graph/tenk/run`의 기본 contract 확인.

HTTP smoke script는 `TENK_API_BASE_URL`을 읽고, 기본값은 `http://127.0.0.1:8000`으로
둔다. package script에 긴 `curl`을 직접 넣기보다 `scripts/*.py`에 smoke logic을 두면
응답 검증, 실패 메시지, timeout 처리가 훨씬 명확하다.

### 테스트 scripts

사용자 확인용 scripts와 별도로, CI/개발 검증용 scripts는 다음처럼 둔다.

```json
{
  "check": "pnpm run lint && pnpm run typecheck && pnpm run test",
  "test:unit": "uv run pytest tests -q",
  "test:tenk": "uv run pytest tests/domains/tenk tests/graph/tenk tests/server/test_tenk_*.py -q",
  "test:tenk:domain": "uv run pytest tests/domains/tenk -q",
  "test:tenk:api": "uv run pytest tests/server/test_tenk_*.py -q",
  "test:tenk:graph": "uv run pytest tests/graph/tenk -q",
  "test:neo4j": "RUN_NEO4J_TESTS=1 uv run pytest -m neo4j tests/integration -q",
  "test:tenk:integration": "RUN_TENK_INTEGRATION_TESTS=1 uv run pytest tests/integration/tenk -q"
}
```

목적:

- `test:tenk:domain`: segmenter, mock extractor, graph mapper, pipeline dry-run 검증.
- `test:tenk:api`: FastAPI router와 request/response contract 검증.
- `test:tenk:graph`: `graph.tenk.workflow` 검증.
- `test:neo4j`, `test:tenk:integration`: Neo4j가 필요한 테스트는 opt-in으로 분리한다.

### 최종 추천 package.json 추가분

초기 구현 직후 `package.json`에는 아래 script를 우선 추가한다.

```json
{
  "check": "pnpm run lint && pnpm run typecheck && pnpm run test",
  "test:tenk": "uv run pytest tests/domains/tenk tests/graph/tenk tests/server/test_tenk_*.py -q",
  "test:tenk:domain": "uv run pytest tests/domains/tenk -q",
  "test:tenk:api": "uv run pytest tests/server/test_tenk_*.py -q",
  "test:tenk:graph": "uv run pytest tests/graph/tenk -q",
  "tenk:fetch": "uv run python scripts/tenk_fetch_report.py --ticker AAPL --form 10-K --output .tmp/tenk/latest-10k.txt --metadata-output .tmp/tenk/latest-10k.json",
  "tenk:parse:dry-run": "uv run python scripts/tenk_parse_dry_run.py --input .tmp/tenk/latest-10k.txt --metadata .tmp/tenk/latest-10k.json --pretty",
  "tenk:init-neo4j": "uv run python scripts/tenk_init_neo4j.py --pretty",
  "tenk:graph:write": "uv run python scripts/tenk_graph_write.py --input .tmp/tenk/latest-10k.txt --metadata .tmp/tenk/latest-10k.json --pretty",
  "tenk:query": "uv run python scripts/tenk_query.py --query \"What are the main risks?\" --metadata .tmp/tenk/latest-10k.json --pretty",
  "tenk:smoke": "pnpm run tenk:fetch && pnpm run tenk:parse:dry-run && pnpm run tenk:graph:write && pnpm run tenk:query",
  "smoke:tenk:http": "uv run python scripts/smoke_tenk_api.py --input .tmp/tenk/latest-10k.txt --metadata .tmp/tenk/latest-10k.json",
  "test:neo4j": "RUN_NEO4J_TESTS=1 uv run pytest -m neo4j tests/integration -q"
}
```

이렇게 하면 사용자는 다음 순서로 직접 확인할 수 있다.

```sh
pnpm run dev
SEC_USER_AGENT="name email@example.com" pnpm run tenk:fetch
pnpm run tenk:parse:dry-run
pnpm run tenk:init-neo4j
pnpm run tenk:graph:write
pnpm run tenk:query
```

## 검증

- 구현 범위:
  - parser domain modules, Neo4j writer, FastAPI routers, LangGraph retrieval
    workflow 1개를 포함한다.
  - 기존 `langgraph_fast.graph.workflow.run_graph`는 계속 동작한다.
  - `dry_run` parse는 Neo4j 없이 동작한다.
- 공개 인터페이스:
  - `ParserPipeline.parse_file`.
  - `ParserPipeline.parse_manifest` 또는 동등한 batch helper.
  - `RetrievalService.retrieve`.
  - `RetrievalService.answer`.
  - `/api/tenk/*`와 `/graph/tenk/run` FastAPI routes.
- 외부 의존성:
  - graph write/retrieval용 `neo4j` Python package와 Neo4j instance.
  - mock extraction이 아닐 때 사용할 `openai` 또는 ChatGPT OAuth proxy provider.
  - `fastapi`, `uvicorn`, `langgraph`, `pydantic`, `httpx`.
- 내부 의존성:
  - 기존 `langgraph_fast.graph.shared.provider` modules.
  - 기존 `langgraph_fast.server.server` app composition.
  - 신규 `domains.tenk` parser contracts.
  - Item-aware extraction prompt templates.
- 위험 영역:
  - `parser.*`에서 `langgraph_fast.*`로 바뀌는 import path churn.
  - 기존 parser API가 CLI subprocess를 호출하는 구조.
  - `ParserPipeline`이 concrete `Neo4jWriter`를 직접 생성하던 결합도.
  - LLM provider 설정 중복.
  - retrieval service의 Neo4j driver setup이 LangGraph node code로 새는 문제.
  - 기존 runtime API 개념과 LangGraph execution model의 중복.

## 검증 기준

- 핵심 동작이 설계대로 동작한다.
- sample 10-K-like text file이 Item section으로 분리된다.
- dry-run parsing이 Neo4j 없이 segment count, graph node count, graph
  relationship count를 반환한다.
- graph mapping이 기존 node label을 보존한다:
  `Company`, `Filing`, `Item`, `SectionText`, `Statement`, `Fact`, `Entity`,
  `Metric`, `Risk`.
- FastAPI route registration이 migrated parser endpoints를 노출한다.
- 기존 `POST /graph/run`이 migration 후에도 동작한다.
- 신규 `POST /graph/tenk/run`은 Neo4j data가 있을 때 retrieval evidence를 사용해
  grounded answer를 반환한다.

### E2E 시나리오

#### E2E 실행 준비

E2E는 repository root의 `package.json` scripts를 기준으로 실행한다. Reason Hwang
영역에는 infra 관련 script가 이미 있으므로, Neo4j 또는 BFF/host 등 외부 실행 환경이
필요한 E2E는 인프라를 먼저 올리고 상태를 확인한 뒤 진행한다.

권장 순서:

```sh
pnpm run infra-up:reason-hwang
pnpm run infra-ps:reason-hwang
pnpm run dev:reason-hwang
pnpm run test:e2e:reason-hwang
```

상황별 사용 기준:

- `pnpm run infra-up:reason-hwang`
  - Neo4j, database, supporting service 등 E2E에 필요한 infra를 먼저 준비한다.
- `pnpm run infra-ps:reason-hwang`
  - infra container/service 상태를 확인한다.
- `pnpm run dev:reason-hwang`
  - 개발 모드로 Reason Hwang 영역 전체를 실행한다.
- `pnpm run start:reason-hwang`
  - build 이후 production-like start 검증이 필요할 때 사용한다.
- `pnpm run test:e2e:reason-hwang`
  - Reason Hwang host 기준 E2E를 실행한다.
- `pnpm run infra-down:reason-hwang`
  - E2E 완료 후 로컬 infra 정리가 필요할 때 사용한다.

인증 또는 외부 API key가 필요한 경우:

- OpenAI API key, ChatGPT OAuth proxy token, SEC 요청용 user agent, private API token 등
  사용자가 제공해야 하는 인증 정보가 없으면 테스트를 임의로 우회하지 않는다.
- 인증 정보가 필요한 지점에서 작업을 중단하고 사용자에게 필요한 env 이름과 용도를
  구체적으로 요청한다.
- 예: `OPENAI_API_KEY`, `CHATGPT_OAUTH_PROXY_URL`, `SEC_USER_AGENT`,
  `COLLECTOR_API_TOKEN` 등.

- Given `Item 1A`, `Item 7`, `Item 8` section이 포함된 local filing text가 있고,
  When `POST /api/tenk/parse-file`을 `dry_run=true`로 호출하면,
  Then 응답에는 0보다 큰 `segments`, `graph_nodes`, `graph_relationships`가 포함된다.
- Given Neo4j가 설정되어 있고 constraints가 초기화되어 있으며,
  When `POST /api/tenk/parse-file`을 `dry_run=false`로 호출하면,
  Then duplicate key failure 없이 written nodes와 relationships가 보고된다.
- Given filing이 Neo4j에 파싱되어 있고,
  When `POST /api/tenk/query`로 risk 또는 metric을 질문하면,
  Then intent와 cited evidence bundle이 포함된 응답이 반환된다.
- Given 기존 starter graph endpoint가 배포되어 있고,
  When `POST /graph/run`을 호출하면,
  Then provider, message, response가 포함된 기존 응답 contract가 유지된다.
- Given parsed filing evidence가 있고,
  When `POST /graph/tenk/run`을 호출하면,
  Then LangGraph workflow가 retrieved evidence 기반 grounded answer를 반환한다.

## 사용 스킬

### Gradate 단계

- apb-unit-test-write
- apb-static-analysis
- apb-gap-analysis

### Validate 단계

- apb-unit-test-write
- apb-bruno-api-tests
- apb-static-analysis
- apb-gap-analysis
- apb-validation-report
