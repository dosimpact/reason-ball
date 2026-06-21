# 3-10-k-parser Implementation Summary

## 목적

이번 변경의 목적은 `3-10-k-parser`를 단순 parser CLI에서 끝내지 않고, 아래를 모두 포함하는 통합 backend로 만드는 것이었습니다.

- filing parse
- Neo4j graph projection
- graph retrieval
- LangGraph-style runtime API
- parser-only API E2E validation

## 구현된 구성요소

### 1. Pipeline-compatible parsing components

- `src/parser/segmenter.py`
  - `FilingSegmenter` 추가
  - settings 기반 chunk 옵션 사용 가능하도록 보정
- `src/parser/llm/extractor.py`
  - `LLMExtractor`를 pipeline adapter로 사용
- `src/parser/graph_mapper.py`
  - 실제 graph projection 수행

### 2. Neo4j graph projection

아래 노드를 실제로 projection 하도록 구현했습니다.

- `Company`
- `Filing`
- `Item`
- `SectionText`
- `Statement`
- `Fact`
- `Entity`
- `Metric`
- `Risk`

관계는 아래를 씁니다.

- `FILED`
- `HAS_ITEM`
- `HAS_SECTION`
- `HAS_STATEMENT`
- `SUPPORTED_BY`
- `MENTIONS`
- `HAS_METRIC`
- `HAS_RISK`

### 3. Retrieval service

- 위치: `src/parser/retrieval/service.py`
- 역할:
  - 질문 intent 분류
  - Neo4j evidence 조회
  - `selected_filing` 추론
  - `evidence_bundle` 반환
  - grounded answer 생성

현재는 `risk`, `metric`, `summary` 중심의 단순 retrieval이며, graph schema와 API 검증이 우선 목표입니다.

현재 기본 LLM provider 설정은 `codex-cli`입니다.

### 4. Runtime store

- 위치: `src/parser/runtime/store.py`
- 역할:
  - thread 저장
  - run 저장
  - snapshot 조회
  - latest run resume

### 5. LangGraph-style runtime API

- 위치: `src/parser/api/langgraph_router.py`

제공 엔드포인트:

- `POST /api/langgraph/threads`
- `POST /api/langgraph/threads/{threadId}/runs/stream`
- `GET /api/langgraph/threads/{threadId}/snapshot`
- `GET /api/langgraph/threads/{threadId}/runs/{runId}/stream`
- `GET /api/langgraph/threads/{threadId}/stream`

stream 응답에는 아래 이벤트가 포함됩니다.

- `text-start`
- `text-delta`
- `text-end`
- `finish`
- `data-retrieval-debug`
- `data-selected-filing`

## 이번에 수정한 핵심 문제

### `parse-manifest` API 보정

- relative manifest path를 프로젝트 루트 기준으로 해석하도록 수정
- manifest record가 `content`만 가진 경우 임시 파일을 만들어 CLI로 넘기도록 보강
- CLI가 non-zero exit를 주더라도 JSON summary가 있으면 API가 그 summary를 우선 해석하도록 수정

### Segmenter 설정 주입 버그 수정

- `ParserPipeline`이 component 생성 시 `settings`를 주입할 때
  `FilingSegmenter`가 이를 `max_chars`로 잘못 받는 문제가 있었음
- 생성자를 settings-aware로 바꿔 chunk config를 정상 해석하게 수정

### E2E 안정화

- Bruno langgraph flow에서 deterministic `runtimeThreadId` 사용
- SSE assertion을 실제 JSON spacing에 맞게 수정
- parser-only validation 범위로 정리

## 검증 기준

현재 공식 검증 기준은 아래 두 Bruno flow입니다.

1. `setup`
  - init-neo4j
  - parse-mock-manifest

2. `langgraph`
  - create-thread
  - run-stream
  - get-snapshot
  - resume-latest-stream

최신 검증 결과는 아래 문서에 있습니다.

- [../../docs/parser-api-e2e-validation-report.md](../../docs/parser-api-e2e-validation-report.md)

## 다음 단계

- 실제 filing sample 여러 건으로 retrieval relevance 검증
- selected filing scope를 더 정교하게 유지
- compare / brief intent 강화
- runtime state를 durable storage로 확장
