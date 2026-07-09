# 10-k-parser-migration Gradate

## Design

기존 `3-10-k-parser` 원본 코드는 삭제하지 않고 기준 구현으로 보존한다. 대상
`20-portfolio/1-reason-hwang/3-langgraph-fast`에는 10-K/SEC filing parser 기능을
새 하위 구조로 포팅한다.

구현은 다음 경계를 따른다.

- Domain: `langgraph_fast.domains.tenk`
  - filing model, HTML/text normalization, Item segmentation, mock extraction,
    graph mapping, parser pipeline, retrieval contract를 담당한다.
- Infrastructure: `langgraph_fast.infrastructure.neo4j`
  - Neo4j writer와 constraint initialization을 담당한다.
- API: `langgraph_fast.server.routers.tenk`
  - `/api/tenk/*` parser/retrieval endpoint와 `/graph/tenk/run` endpoint를
    등록한다.
- LangGraph: `langgraph_fast.graph.tenk`
  - parsed filing graph에서 evidence를 조회해 grounded answer를 반환하는 workflow를
    담당한다.
- Scripts:
  - `tenk:fetch`, `tenk:parse:dry-run`, `tenk:init-neo4j`, `tenk:graph:write`,
    `tenk:query`를 `package.json`에 연결한다.

## Implementation Draft

### Architecture Overview

`langgraph_fast`의 기존 `/graph/run` starter workflow는 보존하고, SEC filing parser는
별도 domain/infrastructure/router/graph 계층으로 추가했다. 원본 parser의 핵심 흐름인
`segment -> extract -> map -> write -> retrieve`는 유지하되, 첫 migration pass에서는
외부 LLM 인증이 필요 없는 `mock` extractor를 기본 실행 경로로 삼았다.

Neo4j가 없는 로컬에서도 `dry_run` parser 검증이 가능해야 하므로 `ParserPipeline`은
`write_to_neo4j=False`를 지원한다. Graph write가 필요한 경우에만 `Neo4jWriter`를
생성한다.

### Modules

| Module | Responsibility | Implementation Evidence |
|---|---|---|
| `langgraph_fast.settings` | Neo4j, LLM provider, parser chunk, SEC user agent 설정 | `src/langgraph_fast/settings.py` |
| `domains.tenk.models` | Filing/section/extraction dataclass contract | `src/langgraph_fast/domains/tenk/models.py` |
| `domains.tenk.normalizer` | HTML/text normalization | `src/langgraph_fast/domains/tenk/normalizer.py` |
| `domains.tenk.segmenter` | PART/ITEM header 기반 section/chunk 분리 | `src/langgraph_fast/domains/tenk/segmenter.py` |
| `domains.tenk.extractor` | mock extraction: statements, facts, entities, metrics, risks | `src/langgraph_fast/domains/tenk/extractor.py` |
| `domains.tenk.graph_mapper` | `Company`, `Filing`, `Item`, `SectionText`, `Statement`, `Fact`, `Entity`, `Metric`, `Risk` graph projection | `src/langgraph_fast/domains/tenk/graph_mapper.py` |
| `domains.tenk.pipeline` | parse orchestration and manifest helper | `src/langgraph_fast/domains/tenk/pipeline.py` |
| `domains.tenk.retrieval` | Neo4j-backed `retrieve()` / `answer()` contract | `src/langgraph_fast/domains/tenk/retrieval.py` |
| `infrastructure.neo4j.writer` | safe label/type validation and graph upsert | `src/langgraph_fast/infrastructure/neo4j/writer.py` |
| `infrastructure.neo4j.constraints` | unique id constraints initialization | `src/langgraph_fast/infrastructure/neo4j/constraints.py` |
| `server.routers.tenk` | FastAPI parser/query/graph endpoints | `src/langgraph_fast/server/routers/tenk.py` |
| `graph.tenk.workflow` | LangGraph retrieval-grounded answer workflow | `src/langgraph_fast/graph/tenk/workflow.py` |
| `scripts/*.py` | fetch, dry-run parse, init, graph write, query, HTTP smoke | `scripts/tenk_*.py`, `scripts/smoke_tenk_api.py` |

### Interfaces

Python-level public contracts:

```python
ParserPipeline.parse_file(path, metadata=None, include_debug=False) -> dict
ParserPipeline.parse_text(text, metadata=None, file_path=None, include_debug=False) -> dict
ParserPipeline.parse_manifest_records(records, limit=None, include_debug=False) -> dict
RetrievalService.retrieve(query, selected_filing=None, **filters) -> RetrievalResult
RetrievalService.answer(query, selected_filing=None, **filters) -> tuple[str, RetrievalResult]
run_tenk_graph(query, selected_filing=None) -> TenkGraphState
init_neo4j_constraints(database=None) -> dict
```

HTTP contracts:

- `POST /api/tenk/init-neo4j`
- `POST /api/tenk/parse-file`
- `POST /api/tenk/parse-manifest`
- `POST /api/tenk/query`
- `POST /graph/tenk/run`

Existing compatibility contract preserved:

- `GET /health`
- `POST /graph/run`

Package scripts:

- `pnpm run tenk:fetch`
- `pnpm run tenk:parse:dry-run`
- `pnpm run tenk:init-neo4j`
- `pnpm run tenk:graph:write`
- `pnpm run tenk:query`
- `pnpm run tenk:smoke`
- `pnpm run smoke:tenk:http`
- `pnpm run test:tenk`

### Dependencies

Added dependency:

- `neo4j>=5.26.0`

Existing dependencies reused:

- `fastapi`
- `httpx`
- `langgraph`
- `openai`
- `pydantic`
- `uvicorn[standard]`
- `pytest`

External runtime dependencies:

- Neo4j at `bolt://127.0.0.1:7687`, default auth `neo4j/test1234`.
- SEC fetch script requires `SEC_USER_AGENT`.
- External LLM extraction is intentionally not enabled in the first migration pass. If
  `LLM_PROVIDER` is not `mock`, parser construction fails with an explicit error.

### Data Flow

1. `tenk:fetch`
   - `scripts/tenk_fetch_report.py` resolves ticker -> CIK via SEC company ticker data.
   - It fetches the latest requested filing form and writes:
     - `.tmp/tenk/latest-10k.txt`
     - `.tmp/tenk/latest-10k.json`
2. `tenk:parse:dry-run`
   - `ParserPipeline(write_to_neo4j=False)` reads the filing.
   - `FilingSegmenter` extracts Item sections.
   - `LLMExtractor` uses mock extraction.
   - `GraphMapper` projects graph nodes/relationships.
   - No Neo4j writer is created.
3. `tenk:init-neo4j`
   - `init_neo4j_constraints()` creates unique `id` constraints.
4. `tenk:graph:write`
   - Same parser pipeline runs with `write_to_neo4j=True`.
   - `Neo4jWriter.write_graph()` upserts nodes and relationships.
5. `tenk:query`
   - `RetrievalService.answer()` resolves selected filing hints and queries Neo4j.
   - Evidence is returned as answer text plus evidence bundle.
6. `/graph/tenk/run`
   - `run_tenk_graph()` invokes the retrieval-grounded LangGraph workflow.

## Gap Analysis (Pre-Validate)

Overall Match Rate: 100%

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| 원본 `3-10-k-parser` 삭제 금지 | 원본 경로는 수정하지 않고 대상 `3-langgraph-fast`에 새 파일 추가 | Matched |
| Domain boundary 추가 | `src/langgraph_fast/domains/tenk/*` | Matched |
| Infrastructure boundary 추가 | `src/langgraph_fast/infrastructure/neo4j/*` | Matched |
| FastAPI router 분리 | `src/langgraph_fast/server/routers/tenk.py`, `server.py` include_router | Matched |
| Existing `/graph/run` 유지 | 기존 `tests/test_app.py` 전체 테스트 통과 | Matched |
| `segment -> extract -> map -> write -> retrieve` 흐름 | `pipeline.py`, `extractor.py`, `graph_mapper.py`, `writer.py`, `retrieval.py` | Matched |
| dry-run parse | `ParserPipeline(write_to_neo4j=False)`, `scripts/tenk_parse_dry_run.py` | Matched |
| Graph DB write | `Neo4jWriter.write_graph()`, `scripts/tenk_graph_write.py` | Matched |
| 조회 테스트 경로 | `RetrievalService.answer()`, `scripts/tenk_query.py`, `/api/tenk/query` | Matched |
| SEC fetch script | `scripts/tenk_fetch_report.py`, `package.json` `tenk:fetch` | Matched |
| package scripts | `20-portfolio/1-reason-hwang/3-langgraph-fast/package.json` | Matched |
| unit/static validation | `pnpm run test`, `pnpm run lint`, `pnpm run typecheck` 통과 | Matched |

## Implementation Notes

- 첫 migration pass에서는 `mock` extractor만 지원한다. OpenAI/ChatGPT OAuth proxy 기반
  structured extraction은 별도 후속 작업으로 분리한다.
- `smoke_tenk_api.py`의 `/graph/tenk/run` 경로는 Neo4j가 준비되어 있어야 의미 있는
  evidence를 반환한다.
- `pnpm run tenk:fetch`는 SEC 정책상 `SEC_USER_AGENT`가 없으면 실패하도록 했다.
- 실제 SEC AAPL 10-K 실행 중 `.txt`로 저장된 SEC HTML 문서가 plain text로 처리되는
  문제가 확인되어, 파일 확장자뿐 아니라 본문 marker 기반 HTML 감지도 추가했다.
- 실제 Neo4j 조회 중 `accession_no`와 `ticker/cik` 조건이 한 쿼리에 섞여 최신 10-Q가
  선택될 수 있는 문제가 확인되어, accession/filing id가 있으면 exact filing만 먼저
  resolve하도록 보정했다.
- `uv sync`를 실행해 `uv.lock`에 `neo4j` dependency를 반영했다.

## Validation Commands Run During Gradate

```sh
pnpm run test:tenk
pnpm run test
pnpm run lint
pnpm run typecheck
uv run python scripts/tenk_parse_dry_run.py --input tests/fixtures/tenk/sample_10k.txt --pretty
SEC_USER_AGENT=... pnpm run tenk:smoke
```

Results:

- `pnpm run test:tenk`: PASS, 9 tests.
- `pnpm run test`: PASS, 11 tests.
- `pnpm run lint`: PASS.
- `pnpm run typecheck`: PASS, 0 errors.
- dry-run script: PASS, `segments=4`, `graph_nodes=36`, `graph_relationships=36`.
- real SEC AAPL 10-K smoke: PASS.
  - fetched Apple Inc. 10-K accession `0000320193-25-000079`, filing date `2025-10-31`.
  - dry-run parse: `segments=23`, `graph_nodes=4261`, `graph_relationships=20028`.
  - Neo4j write: `written_nodes=4261`, `written_relationships=20028`.
  - query: selected filing `acc:0000320193-25-000079`, intent `risk`, evidence bundle returned.
