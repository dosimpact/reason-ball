# US Corporate Filings

## Domain boundary

This domain owns the lifecycle of US corporate disclosure documents, including 10-K and 10-Q filings: issuer discovery, SEC EDGAR synchronization, filing metadata, document download, parsing, persistence, retrieval, and filing-based analysis.

## Owning components

- `2-bff-apps`: SEC EDGAR collection and query APIs under `/api/sec/*`, TypeORM persistence, job status, retries, and remote delivery used by the host.
- `3-langgraph-fast`: 10-K parsing, retrieval, Graph RAG workflows, and project endpoints under `/api/tenk/*`.
- `infra/1-infra-graph-rag`: PostgreSQL and Neo4j persistence plus shared observability dependencies.
- `1-fe-host`: user-facing routes and interactions that consume filing-domain APIs or analysis results.

## Current capability boundary

- Synchronize and list companies.
- Synchronize, backfill, download, retry, list, and inspect SEC filings and their processing state.
- Parse and retrieve 10-K content through FastAPI/LangGraph workflows.
- Persist filing metadata and application state in PostgreSQL and graph-oriented document data in Neo4j.
- Store downloaded SEC primary-document bodies in `sec_collector.public.filings.document_content`; downloaded-report queries do not depend on local files.
- Prepare 10-K Neo4j uniqueness constraints automatically during local FastAPI startup; non-local
  profiles verify the constraints without modifying the database.

10-Q belongs to this domain even when a specific 10-Q workflow is not yet implemented. Stock documents must distinguish implemented behavior from planned coverage.

## Documentation routing

Add business requirements, SEC terminology, filing lifecycle rules, domain API contracts, data design, and domain validation here. Keep workspace commands, shared infrastructure conventions, and cross-domain topology in `../shared/`.

Detailed supporting references currently include:

- [`system-design.md`](system-design.md): implemented database-backed filing content, constraints, migration, commands, and validation boundaries.
- `2-bff-apps/src/sec/API_SPEC.md`
- `3-langgraph-fast/README.md`
- `infra/1-infra-graph-rag/docs/`
