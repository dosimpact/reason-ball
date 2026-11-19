# US Corporate Filings

## Domain boundary

This domain owns the lifecycle of US corporate disclosure documents, including 10-K and 10-Q filings: issuer discovery, SEC EDGAR synchronization, filing metadata, document download, parsing, persistence, retrieval, and filing-based analysis.

## Owning components

- `2-bff-apps`: SEC EDGAR collection and query APIs under `/api/sec/*`, TypeORM persistence, SSE progress, internal retries, and remote delivery used by the host.
- `3-langgraph-fast`: 10-K parsing, retrieval, Graph RAG workflows, and model execution under `/internal/sec-modeling/*` and evidence/fact endpoints under `/api/sec-analysis/*`.
- `infra/1-infra-graph-rag`: PostgreSQL and Neo4j persistence plus shared observability dependencies.
- `1-fe-host`: user-facing routes and interactions that consume filing-domain APIs or analysis results.

## Current capability boundary

- Synchronize and list companies.
- Backfill metadata then optionally download documents through POST SSE; query filing state and separate original/amendment documents.
- Parse and retrieve 10-K content through FastAPI/LangGraph workflows.
- Persist filing metadata and application state in PostgreSQL and graph-oriented document data in Neo4j.
- Store downloaded SEC primary-document bodies in `sec_collector.public.filings.document_content`; filings?includeContent=true does not depend on local files.
- Prepare 10-K Neo4j uniqueness constraints automatically during local FastAPI startup; non-local
  profiles verify the constraints without modifying the database.

10-Q belongs to this domain even when a specific 10-Q workflow is not yet implemented. Stock documents must distinguish implemented behavior from planned coverage.

## Documentation routing

Add business requirements, SEC terminology, filing lifecycle rules, domain API contracts, data design, and domain validation here. Keep workspace commands, shared infrastructure conventions, and cross-domain topology in `../tech-shared/`.

Detailed supporting references currently include:

- [`open-ui-system.md`](open-ui-system.md): SEC 전용 Generative UI 데모 제거 범위와 유지하는 SEC 업무 화면.

- [`system-design.md`](system-design.md): implemented database-backed filing content, constraints, migration, commands, and validation boundaries.
- [`sec-modeling.md`](sec-modeling.md): SEC-MODELING-001, 승인된 모델링 1/2/3·작업 관리·Admin·검색 계약과 구현 인수 기준. pipeline 실데이터 검증 한계는 유지하며 SEC-MODELING-ADMIN-002 공시 상태 표·통계·API Testing의 API 검증을 추가한다.
- `2-bff-apps/src/us-corporate-filings/.docs/api-spec.md`
- `3-langgraph-fast/README.md`
- `infra/1-infra-graph-rag/docs/`

- [SEC Intelligent UI 채팅](intelligent-ui.md): 최신 10-K 기반 LangGraph/AG-UI/OpenUI 경로와 검증 기준.

- [SEC Collector 운영 화면](collector-dashboard.md): SEC-COLLECTOR-001, 기업·공시 조회와 명시적 API 수집 실행.

- [SEC iXBRL 자체 뷰어](ixbrl-viewer.md): SEC-IXBRL-001, 저장된 원문의 taxonomy-free fact 추출과 원문 위치 연결. 구현 작성 완료·실행 미검증·사용자 직접 검증.
