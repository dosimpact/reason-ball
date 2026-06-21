# 3-10-k-parser Context Handoff

## 목적

이 문서는 다음 작업자가 `3-10-k-parser`의 현재 상태를 빠르게 이해하고 바로 이어서 작업할 수 있도록 만드는 handoff 문서입니다.

대상 범위:

- parser pipeline
- Neo4j graph projection
- retrieval service
- LangGraph-style runtime API
- parser-only API validation

범위 제외:

- `4-10-k-chat-bot-next`
- browser UI
- Next adapter validation

## 현재 상태

`3-10-k-parser`는 지금 단순 parser CLI가 아니라, 아래 역할을 함께 수행하는 통합 Python backend입니다.

1. filing parse
2. Neo4j graph write
3. Neo4j retrieval
4. LangGraph-style runtime thread/run API

현재 parser API E2E는 통과한 상태입니다.

- setup flow: `PASS`
- langgraph flow: `PASS`

검증 리포트:

- [../../docs/parser-api-e2e-validation-report.md](../../docs/parser-api-e2e-validation-report.md)

## 이번 작업에서 구현된 것

### Parsing pipeline

- `src/parser/segmenter.py`
  - `FilingSegmenter` 추가
  - settings-aware chunk config 적용
- `src/parser/llm/extractor.py`
  - `LLMExtractor`를 pipeline-compatible extractor로 사용
- `src/parser/graph_mapper.py`
  - 실제 graph projection 구현

### Graph projection

적재되는 핵심 노드:

- `Company`
- `Filing`
- `Item`
- `SectionText`
- `Statement`
- `Fact`
- `Entity`
- `Metric`
- `Risk`

적재되는 핵심 관계:

- `FILED`
- `HAS_ITEM`
- `HAS_SECTION`
- `HAS_STATEMENT`
- `SUPPORTED_BY`
- `MENTIONS`
- `HAS_METRIC`
- `HAS_RISK`

### Retrieval/runtime

- `src/parser/retrieval/service.py`
  - intent 분류
  - Neo4j evidence 조회
  - `selected_filing` 추론
  - grounded answer 생성

- `src/parser/runtime/store.py`
  - thread 저장
  - run 저장
  - snapshot 조회
  - latest run resume

- `src/parser/api/langgraph_router.py`
  - `POST /api/langgraph/threads`
  - `POST /api/langgraph/threads/{threadId}/runs/stream`
  - `GET /api/langgraph/threads/{threadId}/snapshot`
  - `GET /api/langgraph/threads/{threadId}/runs/{runId}/stream`
  - `GET /api/langgraph/threads/{threadId}/stream`

## 현재 동작 방식

### Parse path

1. 문서 입력
2. `FilingSegmenter`가 Item 기준으로 section 분리
3. `LLMExtractor`가 statement/fact/entity/metric/risk 추출
4. `GraphMapper`가 Neo4j payload 생성
5. `Neo4jWriter`가 upsert

### Retrieval path

1. 질문 입력
2. `RetrievalService.detect_intent()`가 intent 분류
3. 선택된 filing이 있으면 scope 적용
4. intent별 Neo4j query 실행
5. `evidence_bundle`과 `selected_filing` 생성
6. grounded answer 반환

### Runtime path

1. thread 생성
2. run stream 실행
3. retrieval 기반 답변 생성
4. SSE stream 반환
5. thread state와 latest run 저장
6. snapshot / latest stream resume 가능

## 검증 상태

공식 검증 범위는 parser-only API입니다.

검증 대상:

- `POST /api/parser/init-neo4j`
- `POST /api/parser/parse-manifest`
- `POST /api/langgraph/threads`
- `POST /api/langgraph/threads/{threadId}/runs/stream`
- `GET /api/langgraph/threads/{threadId}/snapshot`
- `GET /api/langgraph/threads/{threadId}/stream`

Bruno 위치:

- `3-10-k-parser/bruno-api-tests/setup`
- `3-10-k-parser/bruno-api-tests/langgraph`

최신 검증 결과:

- `parse-manifest` 성공
  - `segments=4`
  - `graph_nodes=39`
  - `graph_relationships=53`
  - `written_nodes=39`
  - `written_relationships=53`
- langgraph stream/snapshot/resume 성공

## 바로 실행하는 방법

### 1. 서버 실행

```bash
pnpm --filter @10k/parser run dev
```

### 2. Bruno 검증 실행

```bash
cd 3-10-k-parser/bruno-api-tests
bru run setup --env local --env-var baseUrl=http://127.0.0.1:3406
bru run langgraph --env local --env-var baseUrl=http://127.0.0.1:3406
```

### 3. 수동 API smoke

thread 생성:

```bash
curl -s -X POST http://127.0.0.1:3406/api/langgraph/threads \
  -H 'content-type: application/json' \
  -d '{"assistantId":"sec_filing_assistant_v1"}'
```

mock manifest parse:

```bash
curl -s -X POST http://127.0.0.1:3406/api/parser/parse-manifest \
  -H 'content-type: application/json' \
  -d '{"manifest":"examples/mock_documents.json","limit":1,"pretty":true}'
```

## 이번에 막았던 버그

### 1. `parse-manifest` relative path

- 문제:
  relative manifest path를 `src/` 기준으로 잘못 해석
- 수정:
  프로젝트 루트 기준으로 해석하도록 수정

### 2. manifest `content` record 처리

- 문제:
  파일 경로가 없는 mock manifest record 처리 실패
- 수정:
  API에서 임시 파일을 생성해 CLI로 전달하도록 보강

### 3. CLI non-zero exit 처리

- 문제:
  batch summary JSON이 있어도 API가 무조건 500 처리
- 수정:
  JSON output이 있으면 우선 파싱하도록 수정

### 4. Segmenter constructor binding bug

- 문제:
  `ParserPipeline`이 `settings`를 주입할 때 `FilingSegmenter`가 이를 `max_chars`로 받아 타입 오류 발생
- 수정:
  `FilingSegmenter` 생성자를 settings-aware로 변경

### 5. Bruno langgraph state chaining

- 문제:
  request 간 variable chaining이 안정적이지 않음
- 수정:
  deterministic `runtimeThreadId` 사용

## 현재 한계

1. retrieval은 아직 단순합니다.
- `risk`, `metric`, `summary` 중심
- vector retrieval 없음
- reranking 없음
- compare/brief는 아직 얕습니다

2. runtime store는 durable하지 않습니다.
- 현재 구조는 lightweight runtime store
- production-grade checkpointer는 아직 아님

3. validation은 mock filing 기반입니다.
- 실제 SEC filing 묶음에 대한 품질 검증은 아직 안 함

4. selected filing scope는 더 정교해질 필요가 있습니다.
- 현재는 retrieval 결과에서 최초 filing을 추론하는 수준

## 다음 작업 우선순위

### Priority 1

retrieval 품질 개선

- compare intent 강화
- brief intent 강화
- filing scope resolution 정교화
- item priority/reranking 추가

### Priority 2

runtime/state 개선

- durable storage 도입
- state schema 정리
- run metadata 확장

### Priority 3

실데이터 검증

- 실제 filing sample 3~5건 seed
- risk/metric/summary retrieval relevance 확인
- citation 품질 확인

## 작업 시작 전에 보면 좋은 파일

- [README.md](../README.md)
- [implementation-summary.md](implementation-summary.md)
- [../../docs/parser-api-e2e-validation-report.md](../../docs/parser-api-e2e-validation-report.md)

코드 기준 우선 확인 파일:

- [../src/parser/api/server.py](../src/parser/api/server.py)
- [../src/parser/api/langgraph_router.py](../src/parser/api/langgraph_router.py)
- [../src/parser/core/pipeline.py](../src/parser/core/pipeline.py)
- [../src/parser/graph_mapper.py](../src/parser/graph_mapper.py)
- [../src/parser/retrieval/service.py](../src/parser/retrieval/service.py)
- [../src/parser/runtime/store.py](../src/parser/runtime/store.py)

## 한 줄 요약

현재 `3-10-k-parser`는 parser + Neo4j graph writer + retrieval + LangGraph-style runtime API까지 포함하는 통합 backend이며, parser-only API E2E는 통과한 상태입니다.
