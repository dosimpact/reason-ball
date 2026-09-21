# US Corporate Filings

## Domain boundary

This domain owns the lifecycle of US corporate disclosure documents, including 10-K and 10-Q filings: issuer discovery, SEC EDGAR synchronization, filing metadata, document download, parsing, persistence, retrieval, and filing-based analysis.

## Owning components

- `2-bff-apps`: SEC EDGAR collection and query APIs under `/api/sec/*`, TypeORM persistence, SSE progress, internal retries, and remote delivery used by the host.
- `3-langgraph-fast`: 10-K parsing, retrieval, Graph RAG workflows, and project endpoints under `/api/tenk/*`.
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

- [`a2ui-system.md`](a2ui-system.md): 회사 조회·공시 선택·선택 공시 기반 분석/요약 보고서 A2UI 설계 (구현 진행 중).

- [`system-design.md`](system-design.md): implemented database-backed filing content, constraints, migration, commands, and validation boundaries.
- `2-bff-apps/src/us-corporate-filings/.docs/api-spec.md`
- `3-langgraph-fast/README.md`
- `infra/1-infra-graph-rag/docs/`
