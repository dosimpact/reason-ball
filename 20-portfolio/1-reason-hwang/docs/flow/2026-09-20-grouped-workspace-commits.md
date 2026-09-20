# Grouped workspace commits

- Date: 2026-09-20
- Domain: shared
- Context: User requested grouping the remaining workspace changes into a few related commits after the SEC storage commits.
- Groups: LangGraph primary graphs and Neo4j initialization; OAuth proxy packaging and checks; Bruno tooling; domain documentation and validation (including concurrently staged backfill API collections); Storybook configuration and examples.
- Validation on this turn:
  - LangGraph `uv run pytest -q`: 100 passed, 7 opt-in tests skipped.
  - OAuth proxy `pnpm test:unit`: 17 passed.
  - Host `pnpm --filter reason-hwang-fe-host exec vitest run --project storybook`: 22 files, 83 tests passed on retry. Initial execution encountered a Vite dependency-cache reload failure; its owned process was terminated.
  - No new production application behavior was implemented in this commit-grouping task. Existing per-feature flow records retain their detailed validation evidence and limitations.
- Stock references: [shared test design](../stock/shared/test-design.md), [workspace](../stock/shared/workspace.md).
- Credentials, local database contents and generated caches are excluded. Changes are committed locally; no remote push performed.
