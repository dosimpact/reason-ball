# Main graph move to primary graphs

- Date: 2026-09-20
- Domain: `shared`
- Context: The top-level `main_graph` was moved from `src/graph/main_graph/` to
  `src/graph/primary_graphs/main_graph/` to distinguish primary application graphs from reusable
  subgraphs.
- Change: Updated internal Python imports, FastAPI and MCP imports, the `langgraph.json` graph entry,
  and runtime documentation to the new package path. Added an explicit `primary_graphs` package
  marker. The public LangGraph graph ID remains `main_graph`.
- Rationale: Make the graph hierarchy explicit without changing API contracts or runtime graph IDs.
- Affected stock:
  - `docs/stock/shared/system-design.md` (`FastAPI and LangGraph`)
- Validation:
  - New module import and `langgraph.json` entry resolution: passed.
  - `uv run pytest`: 98 passed, 7 skipped.
  - Ruff for the moved graph package and direct server import: passed.
  - `uv run --with pyright pyright`: 0 errors.
  - `uv build`: source distribution and wheel built successfully.
  - `git diff --check`: passed.
  - Full lint of `src/server/mcp/router.py` still reports two pre-existing findings unrelated to
    this import-path change.
