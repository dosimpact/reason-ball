# Workspace Monorepo Orchestration Completion Report

## Summary

- Feature: `workspace-monorepo-orchestration`
- Phase: Report
- Match rate: 100%
- Report date: 2026-06-12
- Status: Completed for the documented workspace orchestration scope

The repository now has a single root control plane for the numbered project
targets:

- `0-harness`
- `1-infra-graph-rag`
- `2-10-k-collector`
- `3-10-k-parser`
- `4-10-k-chat-bot-next`

Root scripts now coordinate local infrastructure, collector, parser, chatbot,
unit checks, browser E2E checks, Graph RAG smoke checks, and project doctor
verification.

## Related Documents

- Plan: `docs/01-plan/features/workspace-monorepo-orchestration.plan.md`
- Design: `docs/02-design/features/workspace-monorepo-orchestration.design.md`
- Analysis: `docs/03-analysis/project-doctor-2026-06-12.analysis.md`
- Operations runbook: `docs/05-runbooks/operations.md`

## Completed Items

### Workspace Control Plane

- Added root `pnpm-workspace.yaml`, `package.json`, `turbo.json`, and shared
  workspace scripts.
- Standardized root commands for `infra:up`, `infra:down`, `dev`, `build`,
  `start`, `test:unit`, `test:e2e`, `test:graph-rag`, and doctor modes.
- Made the root lockfile the workspace dependency source of truth.

### Infrastructure Orchestration

- Aligned local infrastructure defaults around PostgreSQL host port `55432`,
  Grafana port `3001`, parser port `3406`, collector port `3305`, and chatbot
  port `3003`.
- Added static and live doctor checks for PostgreSQL, Neo4j, Loki, Grafana,
  collector, parser, and chatbot service contracts.

### Parser Runtime

- Replaced ad-hoc parser virtual environment assumptions with `uv`-backed
  package scripts.
- Added parser package metadata, runtime store smoke checks, Graph RAG request
  contracts, and parser-to-collector request correlation checks.

### Collector Runtime

- Aligned collector package scripts and environment examples with root
  orchestration.
- Added targeted ticker/CIK collection support and explicit database migration
  execution.
- Added request ID propagation and structured service logs.

### Chatbot Runtime

- Aligned chatbot local defaults with the root stack.
- Added root-managed Next type generation hygiene so generated `next-env.d.ts`
  changes do not leak from local dev or E2E runs.
- Added CopilotKit investment assistant E2E coverage, SEC API contract E2E
  coverage, and SEC playground E2E coverage.

### Operations And Verification

- Added `scripts/project-doctor.mjs` with static, verification, E2E, and live
  service probe modes.
- Added `scripts/run-doctor-probe.mjs` and `pnpm run doctor:probe:local` to
  start the local stack, run live probes, and clean up in one command.
- Added `scripts/test-e2e.mjs` to boot the local stack, run Playwright, and
  tear down services.
- Added `scripts/test-parser-collector-graph-rag.mjs` to verify collector,
  parser, Neo4j ingestion, and Graph RAG retrieval as one path.
- Added `docs/05-runbooks/operations.md` with release gates, runtime recovery
  guidance, port contracts, generated artifact handling, and request ID
  correlation guidance.
- Added `.github/workflows/project-gates.yml` so pull requests and `main` pushes
  run `doctor:verify` plus browser E2E, while live Graph RAG smoke runs nightly
  or by manual dispatch.

## Quality Metrics

Latest verified commands:

- `pnpm run doctor:e2e`
  - Result: PASS
  - Covered: doctor syntax, e2e runner syntax, whitespace, infra compose
    config, chatbot lint, workspace build, workspace unit checks, doctor probe
    runner syntax, and 17 Playwright E2E tests.
- `pnpm run test:e2e`
  - Result: PASS
  - Covered: 19 Playwright E2E tests, including investment assistant panels,
    selected filing preservation, structured SEC API bad requests, SEC
    playground recovery panels, stale playground selection clearing, and
    full-text success flow.
- `pnpm run test:graph-rag`
  - Result: PASS
  - Covered: infra boot, collector company/filing sync, parser collector parse
    job, Neo4j writes, and `/api/graph-rag/query`.
- `DOCTOR_PROBE_ATTEMPTS=30 DOCTOR_PROBE_DELAY_MS=1000 pnpm run doctor:probe`
  - Result: PASS
  - Covered: live TCP/HTTP probes, stable JSON response assertions, and
    parser-to-collector request ID correlation.
- `pnpm run doctor:probe:local`
  - Result: PASS
  - Covered: infra startup, chatbot DB migration, collector/parser/chatbot
    startup, live doctor probes, `next-env.d.ts` restoration, app port cleanup,
    and infra teardown.
- `node scripts/project-doctor.mjs --json`
  - Result: PASS
  - Covered: static checks for all five numbered targets.
- `git diff --check`
  - Result: PASS
- `.github/workflows/project-gates.yml`
  - Result: ADDED
  - Covered: Node 24, pinned pnpm install, `doctor:verify`, browser E2E, and
    scheduled/manual live Graph RAG smoke.

Latest `doctor:e2e` revalidation also confirmed `next-env.d.ts` restoration,
project app port cleanup, and `graph-rag`/`sec-filings` container cleanup after
the browser gate finished.

Latest SEC admin/API recovery hardening:

- Bad SEC filing-list and POST request payloads now return structured
  `sec_bad_request` problems with request id and recovery guidance.
- The SEC playground clears stale filing/full-text/summary/brief state when the
  company input changes and shows a local structured recovery panel for blank
  company input.
- Static doctor requires the SEC response smoke bad-request contract, SEC API
  bad-request e2e coverage, and SEC playground stale-selection coverage.

Latest Graph RAG smoke output:

- Ticker: `AAPL`
- Target filing: `0000320193-26-000013`
- Parser job success count: `1`
- Neo4j nodes written: `1909`
- Neo4j relationships written: `4536`
- Evidence count: `4`
- Evidence quality contract: passed for selected filing id, citation labels,
  supported node types, item codes, plain-text evidence, positive scores,
  reasons, duplicate prevention, answer focus, and item citations.
- Evidence preview:
  - `Item 1A` / `SectionText` / `1A` / score `1.00` / text length `283`
  - `Item 1A` / `Risk` / `1A` / score `0.92` / text length `283`
  - `Item 1A` / `Risk` / `1A` / score `0.84` / text length `402`
  - `Item 1A` / `Risk` / `1A` / score `0.76` / text length `274`

## Residual Risks

- The bkit/ckit MCP tools named in the project instructions were not exposed in
  this session, so phase status updates were maintained through local project
  files and executable gates.
- Remote CI depends on GitHub-hosted runner availability and Docker support for
  the e2e/Graph RAG jobs. Local `doctor:verify` and `test:e2e` remain the
  immediate fallback when CI infrastructure is unavailable.
- Manual service probes still require the local stack to be running. Use
  `pnpm run doctor:probe:local` for the self-contained local lifecycle, or use
  `pnpm run dev` before `pnpm run doctor:probe` when debugging an already
  running stack.

## Lessons Learned

- A monorepo control plane is only useful when it owns cleanup and generated
  artifact hygiene, not just startup commands.
- Live service probes need JSON contract assertions and request correlation;
  raw port reachability is too weak to prove the stack is usable.
- Parser, collector, and chatbot ports must be checked across docs, scripts,
  environment examples, and tests to avoid stale local defaults.

## Next Steps

- Keep `pnpm run doctor:e2e`, `pnpm run test:graph-rag`, and
  `pnpm run doctor:probe:local` as the local release gate set.
- Keep the active `investment-assistant-copilotkit` report evidence current as
  Graph RAG ranking and filing ingestion change.
- Monitor the new GitHub Actions workflow after the first remote run and adjust
  runner timeouts only if the hosted environment is slower than local gates.
