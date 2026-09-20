# LangGraph Graph DB stock documentation

- Date: 2026-09-20
- Scope: `tech-shared`, package `3-langgraph-fast`
- Context: Neo4j behavior was distributed across infrastructure, parser, writer, retrieval, API, and
  startup code without one package-owned current-state document.
- Change: Added a package INDEX and `4-graph-db.md` covering ownership, settings, profile-based
  constraint preparation, graph model, identities, upsert behavior, retrieval, APIs/CLI,
  observability, validation, and current limitations. Updated the root and tech-shared maps.
- Rationale: Make the implemented Neo4j contract discoverable without mixing it with PostgreSQL
  saver behavior or infrastructure provisioning details.
- Affected stock:
  - `docs/stock/tech-shared/3-langgraph-fast/INDEX.md`
  - `docs/stock/tech-shared/3-langgraph-fast/4-graph-db.md`
  - `docs/stock/tech-shared/INDEX.md`
  - `docs/INDEX.md`
- Validation: Link targets, implementation names, environment keys, constraints, labels,
  relationships, commands, and formatting were checked against the current repository.
