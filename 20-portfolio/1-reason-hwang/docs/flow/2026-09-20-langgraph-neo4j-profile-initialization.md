# LangGraph Neo4j profile-based initialization

- Date: 2026-09-20
- Domain: `us-corporate-filings`, `shared`
- Context: Neo4j constraints required a separate manual API or CLI call while PostgreSQL schema
  preparation already followed `ENV_PROFILE` startup policy.
- Change: FastAPI startup now creates the nine 10-K graph uniqueness constraints idempotently for
  `local`. For `dev`, `staging`, and `production`, it only verifies the required constraint names
  and fails fast when any are missing. The explicit Neo4j initialization CLI remains available for
  out-of-band preparation.
- Rationale: Apply one predictable environment policy to the service's PostgreSQL and Neo4j schema
  dependencies without allowing runtime DDL in non-local environments.
- Affected stock:
  - `docs/stock/shared/system-design.md` (`FastAPI and LangGraph`)
  - `docs/stock/us-corporate-filings/README.md` (`Current capability boundary`)
- Validation:
  - `uv run pytest`: 98 passed, 7 skipped.
  - Ruff on changed Python files: passed.
  - `uv run --with pyright pyright`: 0 errors.
  - Local startup on port 18000 completed; `/health` and `/health/postgres` returned HTTP 200.
  - Live Neo4j verification found all 9 expected constraints after local preparation.
  - Full-project Ruff remains red on 51 pre-existing findings outside this change.
