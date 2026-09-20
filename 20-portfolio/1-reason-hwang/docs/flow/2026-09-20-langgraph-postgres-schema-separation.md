# LangGraph PostgreSQL schema separation

- Date: 2026-09-20
- Domain: `shared`
- Context: SEC collector tables and LangGraph application/checkpointer tables shared
  `sec_collector.public`, leaving ownership boundaries implicit.
- Change: Added `POSTGRES_SCHEMA` with default `langgraph`. The LangGraph pool uses
  `search_path=langgraph,public`. Local startup creates the schema and moves only LangGraph-owned
  application and checkpointer tables from `public` under an advisory lock before applying
  idempotent migrations. Non-local profiles verify the dedicated schema without DDL. Schema
  migration marker version 2 records the namespace separation.
- Rationale: Keep one logical database while isolating BFF SEC storage from LangGraph-owned tables,
  migration history, and checkpoints.
- Safety: Existing tables use PostgreSQL `ALTER TABLE ... SET SCHEMA`, preserving rows, indexes,
  constraints, and foreign-key definitions. Startup fails on source/target table conflicts rather
  than merging or dropping data.
- Affected stock:
  - `docs/stock/tech-shared/system-design.md` (`FastAPI and LangGraph`)
  - `docs/stock/tech-shared/3-langgraph-fast/3-langgraph-db-saver.md`
- Validation:
  - Full unit suite: 101 passed, 7 skipped.
  - PostgreSQL integration suite for schema, saver, repositories, and snapshot migration: 7 passed.
  - Ruff on changed Python files: passed.
  - Pyright: 0 errors.
  - Local FastAPI startup and `/health/postgres`: passed.
  - Production-profile schema verification completed without DDL.
  - Live `sec_collector` inspection: all 12 LangGraph-owned tables are in `langgraph`; zero remain
    in `public`; SEC `companies`, `filings`, and TypeORM `migrations` remain in `public`.
  - `langgraph.schema_migrations` contains version 1 and namespace-separation version 2 markers.
  - Source distribution and wheel build: passed; `git diff --check`: passed.
