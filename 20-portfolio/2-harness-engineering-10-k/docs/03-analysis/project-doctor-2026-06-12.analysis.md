# Project Doctor Analysis - 2026-06-12

## Scope

Doctor mode scope covered the numbered project targets:

- `0-harness`
- `1-infra-graph-rag`
- `2-10-k-collector`
- `3-10-k-parser`
- `4-10-k-chat-bot-next`

## Status Source

- `docs/.pdca-status.json`
- Active primary feature: `workspace-monorepo-orchestration`
- Current phase: `report`
- Project level in status file: `Starter`

The requested `bkit_detect_level`, `bkit_get_status`, and `bkit_pdca_next`
MCP tools were not exposed in this session, so local files and executable
project gates were used as the authoritative evidence.

## Findings And Fixes

### 0-harness

- Checked local harness requirement and skill files.
- No runnable package metadata is present for this target.
- Risk: harness validation is documentation-driven unless the bkit MCP tools are
  available in the session.
- Removed deprecated root `turbo run --parallel` usage from workspace `dev` and
  `start`; `turbo.json` already marks long-running service tasks as
  `persistent`.
- Added `--no-update-notifier` to root Turbo gates so development, build, unit,
  and clean logs stay focused on project-owned output.

### 1-infra-graph-rag

- Verified Docker Compose configuration with `pnpm --filter @10k/infra run build`.
- Fixed `.env.example` PostgreSQL host port to match root orchestration default:
  `55432`.

### 2-10-k-collector

- Verified TypeScript with `pnpm --filter @10k/collector run typecheck`.
- Fixed split PostgreSQL fallback port from `5433` to `55432`.
- Aligned collector `.env.example` with the workspace infra default.
- Found collector startup deprecation from TypeORM `DataSource.synchronize()`,
  which called `pg` query flow while schema synchronization was already running.
- Replaced runtime `synchronize: true` with explicit TypeORM migrations using
  `migrationsRun: true` and `synchronize: false`.
- Added the initial collector schema migration for `companies`, `filings`,
  constraints, and query indexes.
- Verified startup against both the existing collector database and a fresh
  temporary database with `NODE_OPTIONS=--trace-deprecation`; the `pg`
  deprecation warning no longer appears.

### 3-10-k-parser

- Found e2e-blocking startup bug: parser scripts checked for `uv` CLI but then
  ran `python3 -m uv`, which failed when the active `python3` did not have the
  `uv` module installed.
- Fixed `scripts/ensure-uv.sh` to return the real `uv` executable path.
- Updated parser package scripts to execute that path directly.
- Fixed parser API default port from `3306` to `3406`.
- Aligned parser `.env.example` with the workspace defaults.
- Verified parser `/health` and `/openapi.json` locally.

### 4-10-k-chat-bot-next

- Fixed lint toolchain mismatch by pinning `ultracite` to `7.0.11`, matching the
  installed Biome `2.3.11` schema.
- Ran formatter and resolved remaining lint violations.
- Replaced filing-search highlight `dangerouslySetInnerHTML` with safe React
  node rendering.
- Added default switch handling for parser SSE event adaptation.
- Stabilized React list keys and hook dependency declarations.
- Added `allowedDevOrigins` for `127.0.0.1` to remove Next dev e2e origin
  warning.
- Aligned `.env.example` with local workspace Postgres, parser, and collector
  defaults.
- Confirmed the CopilotKit/Express build warning came from the public
  `@copilotkit/runtime/v2` barrel export importing every endpoint adapter.
- Switched CopilotKit endpoint creation to the public Hono-specific export and
  added a narrow webpack warning filter for the upstream Express `view.js`
  dynamic require warning. This avoids brittle internal package imports while
  keeping build output focused on actionable warnings.
- Updated peer-sensitive chatbot dependencies for the current Next 16/React 19
  runtime:
  - `next` to `16.2.9`, which removes the stale bundled
    `baseline-browser-mapping` age warning from the build path.
  - `next-auth` to `5.0.0-beta.31`, which declares Next 16 peer support.
  - `next-themes` to `0.4.6`, which declares React 19 peer support.
  - `@vercel/otel` to `2.1.2` and added its matching OpenTelemetry 2.x/0.219
    SDK peers.
- Replaced the old `next-themes/dist/types` internal type import with the
  public `next-themes` `ThemeProviderProps` export.
- Hardened `test:unit` by clearing only generated Next type directories, then
  running `next typegen` before `tsc --noEmit`. This prevents stale `.next`
  app type files from breaking typecheck after framework upgrades.
- Kept e2e console-error enforcement strict while filtering the known Chromium
  font preload warning for Next-managed `/_next/static/media/*.woff2` files.
- Replaced the chatbot migration script's `npx tsx` invocation with local
  `tsx` execution, removing npm unknown env config warnings from e2e startup.
- Aligned the local chatbot `.env.local` database URLs and README examples with
  the workspace PostgreSQL host port `55432`, so direct package-level
  `db:migrate` matches root orchestration.
- Updated the root e2e orchestrator to start collector, parser, and chatbot via
  their direct local runtime commands instead of `pnpm run dev` wrappers. Normal
  teardown no longer prints pnpm recursive failure noise for intentionally
  terminated dev services.
- Scoped Playwright e2e runner environment cleanup by omitting inherited
  `NO_COLOR` only for the Playwright child process. This removes the Node
  `NO_COLOR`/`FORCE_COLOR` warning without changing the parent shell or service
  environments.
- Corrected stale chatbot and collector README quick-start metadata: target
  names, local relative paths, chatbot default port `3003`, and SEC API section
  numbering now match the workspace layout.
- Added `docs/05-runbooks/operations.md` as the project-wide operations runbook
  covering the numbered targets, port/env contracts, baseline bring-up, health
  checks, release gate, and symptom-based recovery for collector, filing
  freshness, local filing files, parser runtime, Graph RAG/Neo4j, and chatbot
  database/auth failures.
- Linked the operations runbook from the root, infra, parser, and chatbot
  READMEs. The parser README now consistently documents the current runtime port
  `3406` and `uv`-based CLI execution instead of the stale `3306` examples.
- Added `scripts/project-doctor.mjs` and root `doctor`, `doctor:verify`,
  `doctor:probe`, and `doctor:e2e` commands. The static doctor checks all
  numbered targets exactly: workspace harness, infra, collector, parser, and
  chatbot. It validates package metadata, required scripts, env examples,
  service smoke paths, runbook links, parser/runtime artifacts, SEC API/e2e
  artifacts, and cross-target port/env contracts.
- Hardened live service probing. `doctor:probe` now fails when required local
  TCP/HTTP probes are unavailable, covering PostgreSQL, Neo4j Bolt, Neo4j
  Browser, Loki, Grafana, collector, parser, and chatbot endpoints.
- Hardened live service probing against startup races. `doctor:probe` now runs
  probes concurrently and retries services with realistic startup windows,
  preventing a healthy dev stack from failing only because Loki, Grafana,
  Uvicorn, Next.js, or NestJS is still warming up.
- Added request tracing across the live HTTP boundary. The chatbot proxy now
  creates or forwards `x-request-id`, SEC structured API errors include the same
  ID in the response body, and collector/parser/chatbot HTTP probes verify that
  internal services echo the request ID header.
- Hardened live HTTP probes beyond reachability. `doctor:probe` now parses JSON
  responses for collector status summary, parser health, and CopilotKit info,
  and fails when stable body contracts drift. Parser health probing explicitly
  checks `jobStore.maxJobs` and `runtimeStore.foreignKeyCascade`.
- Added API-visible cross-service request tracing for parser collector-parse
  jobs. Parser records collector echoed `x-request-id` values as
  `collectorRequestIds`, reports `collectorRequestIdMatched`, and
  `doctor:probe` now creates a lightweight parser-to-collector job to verify
  the same correlation ID crosses both services.
- Closed stale local validation defaults that could send operators to dead
  ports. The parser LangGraph validation script, Bruno local environment,
  Postman environment/collection, parser context handoff, and chatbot smoke
  scripts now use parser `3406` and chatbot `3003`. Static doctor checks fail
  if those assets regress to the old `3306` parser or `3300` chatbot defaults.
- Hardened local smoke script execution. Static doctor now verifies directly
  invoked validation scripts are executable, and chatbot smoke scripts create
  payload/cookie/stream files under a temporary directory with `trap` cleanup
  so failed runs do not leave stale `/tmp/e2e-chat-*` artifacts.
- Removed the tracked chatbot TypeScript incremental cache from source control
  and redirected `tsBuildInfoFile` to `.next/cache/tsconfig.tsbuildinfo`.
  Static doctor now fails if `4-10-k-chat-bot-next/tsconfig.tsbuildinfo`
  reappears or if root `.gitignore` stops ignoring `*.tsbuildinfo`.
- Added a `preserve-next-env.sh` wrapper around chatbot `dev`, `build`, and
  `test:unit` scripts. Next.js can rewrite `next-env.d.ts` between
  `.next/dev/types/routes.d.ts` and `.next/types/routes.d.ts`; the wrapper
  snapshots and restores the file so local verification does not create
  unrelated generated-file churn. Static doctor now verifies the committed
  `next-env.d.ts` points to the production route type path. The wrapper handles
  interrupt signals by exiting through a single `EXIT` cleanup path, avoiding
  duplicate cleanup failures on `Ctrl-C`.
- Split the `next-env.d.ts` doctor contract by runtime mode. Regular
  `doctor`/`doctor:verify` still require the production route type import, but
  `doctor:probe` accepts the temporary `.next/dev/types/routes.d.ts` import
  while a live Next dev server is running and reports that the wrapper restores
  the snapshot on exit.
- Extended the same `next-env.d.ts` snapshot/restore protection to the
  workspace e2e orchestrator. `scripts/test-e2e.mjs` starts Next dev directly,
  so it now snapshots the file before service startup and restores it during
  cleanup. Static doctor verifies this guard through the e2e runner contract.
- Added targeted SEC filing seed support for collector CLI/API flows. The old
  local collection path depended on the first page of sorted CIKs, which could
  miss product-demo tickers such as AAPL. `filings:collect`, `filing-sync-jobs`,
  and `filing-download-jobs` now accept `tickers`/`ciks` so operators can seed
  specific companies without broad page scans.
- Hardened collector package-level CLI defaults. `companies:sync`,
  `filings:collect`, and API start scripts now run through a local environment
  wrapper that exports the workspace PostgreSQL default on `55432` unless the
  shell already provides `DATABASE_URL`, preventing stale local `.env` files
  from steering direct collector commands to dead ports.
- Added SEC API log correlation for request tracing. Structured SEC API
  failures now emit `sec_api_problem` JSON warnings with `requestId`, stable
  error code, HTTP status, and recovery/cause presence flags so operators can
  search server logs or Loki without logging raw low-level cause text.
- Extended request traceability to service boundaries. Collector and parser HTTP
  middleware now emit structured `collector_http_request` and
  `parser_http_request` access events with `requestId`, method, path, status,
  and duration so operator-visible request IDs can be followed beyond the
  chatbot API layer.
- Extended correlation into job workflows. Collector job endpoints now return
  `correlationId` and include it in job service logs; parser collector-parse
  jobs persist `correlationId`, emit `parser_collector_parse_job` lifecycle
  events, and forward the value to collector API calls as `x-request-id`.
- Added doctor verification mode so `pnpm run doctor:verify` runs doctor syntax,
  e2e runner syntax, `git diff --check`, infra compose config, chatbot lint,
  workspace build, and workspace unit gates in one command. `doctor:e2e`
  extends the same gate with the full Playwright E2E run.
- Aligned infra compose fallback ports with the workspace contract:
  PostgreSQL now defaults to `55432` and Grafana to `3001`, matching
  `.env.example`, README, and the operations runbook.
- Replaced the stale browser metadata title/description from the original
  template with `10-K Investment Copilot` product metadata.
- Added environment-aware `metadataBase` resolution using `NEXT_PUBLIC_APP_URL`,
  `AUTH_URL`, Vercel production URL, or the local `http://localhost:3003`
  fallback. This removes Next's Open Graph/Twitter image metadata warning
  without hard-coding the old template domain.
- Added `NEXT_PUBLIC_APP_URL=http://localhost:3003` to chatbot environment
  examples and local defaults.
- Rebranded the visible sidebar label from `Chatbot` to `10-K Copilot`.
- Fixed the first-screen CopilotKit chat panel height by converting the main
  chat section to a flex column and constraining the chat body with
  `min-h-0 flex-1`. The input box and CopilotKit disclaimer now stay inside the
  card instead of being clipped by the section's overflow boundary.
- Added a structured runtime issue model for investment-assistant dependency
  failures across `filing-catalog`, `filing-reader`, `graph-rag`, and
  `parser-runtime`.
- Updated the investment-assistant server path so filing catalog, filing reader,
  and Graph RAG failures are recorded in shared state instead of disappearing
  into generic assistant text.
- Updated the CopilotKit LangGraph bridge so parser runtime failures preserve
  the preflight filing workspace state, emit a degraded runtime notice, and
  still publish a state snapshot and A2UI surface.
- Added `Runtime Status` cards to the right-side workspace panel, inline chat
  workspace snapshot, and A2UI dashboard so users can see what dependency failed
  and how to recover.
- Added `scripts/investment-assistant-runtime-state-smoke.ts` and wired it into
  chatbot `test:unit` to prove runtime issues produce a degraded dashboard
  surface with parser recovery instructions.
- Extended the SEC filing repository and investment-assistant state with
  collector freshness and provenance fields: `updated_at`, `parser_status`,
  local-file availability, document source, and downloaded status.
- Added `Collector DB`, document source, collector update date, and parser
  status indicators to the right-side workspace panel, inline chat workspace
  snapshot, A2UI dashboard, and assistant text response.
- Added filing freshness classification derived from collector `updated_at`:
  `current`, `stale`, or `unknown`, with refresh guidance for stale or missing
  collector timestamps. The status now appears in assistant text, the right-side
  workspace panel, inline chat snapshot, recent filing rows, and A2UI dashboard.
- Added a Playwright-only stale freshness hook for deterministic freshness UX
  coverage. The UI e2e gate now proves stale collector timestamps render
  `Freshness: refresh recommended`, collector age detail, and concrete refresh
  job guidance. The A2UI dashboard also now includes the refresh guidance line,
  and the runtime-state smoke verifies it.
- Added a Playwright-only unknown freshness hook for deterministic missing
  collector timestamp coverage. The UI e2e gate now proves missing collector
  timestamps render `Collector updated: unknown`, `Freshness: unknown`,
  timestamp-unavailable detail, and collector metadata/download job guidance.
  The runtime-state smoke also verifies the same unknown freshness guidance in
  the A2UI dashboard model.
- Added a decision-quality checklist to the investment-assistant state,
  assistant text, right-side workspace panel, inline chat snapshot, and A2UI
  dashboard. The checklist now labels whether the brief is ready, review-needed,
  or blocked based on filing selection, freshness, local filing text, brief
  evidence, Graph RAG evidence, and runtime reliability.
- Added a product-facing data readiness layer to the investment assistant.
  `Data Readiness` now appears in the right-side workspace panel, inline chat
  snapshot, and A2UI dashboard before the user relies on an investment brief.
  It checks filing catalog availability, local filing text, parser graph
  evidence, filing freshness, and runtime dependencies with item-level recovery
  actions.
- Prioritized collector freshness as the primary readiness action when the
  selected filing has stale or unknown freshness, because a latest-filing
  decision should refresh source metadata before asking for better citations.
- Extended static doctor, runtime-state smoke, and Playwright e2e coverage for
  the Data Readiness contract. The browser gate now requires `Data Readiness`,
  `Filing catalog`, `Local filing text`, and `Parser graph` in the investment
  assistant UI.
- Added structured SEC API problem responses for company not found, filing not
  found, collector database unavailable, and local filing file unavailable
  cases. Responses now include stable `code`, user-facing `message`, optional
  `cause`, and concrete `recovery` guidance.
- Hardened SEC filings pagination inputs so invalid `limit` or `cursor` values
  fall back to bounded defaults instead of producing ambiguous empty slices.
- Updated the admin SEC playground to read the structured problem contract and
  display `code`, `cause`, and `recovery` separately. Empty filing results and
  missing selected filing actions now tell the operator which collector job or
  UI step to run next.
- Added authenticated Playwright coverage for the SEC API contract. The e2e gate
  now verifies unauthenticated rejection, authenticated AAPL filing list
  retrieval, full-text reader payload generation, company-not-found recovery,
  empty form-filter notices, and filing-not-found recovery.
- Added admin SEC playground interaction coverage. The e2e gate now clicks the
  Summary and Brief buttons before a filing is selected, verifies the
  `sec_no_selected_filing` recovery panel, verifies company-not-found and
  full-text filing-not-found recovery panels, and confirms successful AAPL
  filings/full-text responses render in the admin UI.
- Adjusted SEC API contract test authentication to redirect guest sign-in to
  `/api/auth/session` instead of `/`, avoiding unnecessary CopilotKit client
  startup during API-only tests.
- Added a Playwright-only investment-assistant failure hook for parser runtime
  stream failures and wired the root e2e service environment to enable it only
  during orchestration tests. The UI e2e gate now proves the live CopilotKit
  workspace shows `Runtime Status`, `Parser runtime unavailable`, and parser
  recovery guidance while preserving the selected filing context.
- Added a Playwright-only Graph RAG failure hook at the graph retrieval client
  boundary. The UI e2e gate now proves the live CopilotKit workspace shows
  `Runtime Status`, `Graph evidence unavailable`, Graph RAG service recovery,
  and Neo4j recovery guidance while preserving the selected filing context.
- Added a Playwright-only filing reader failure hook at the filing document
  loading boundary. The UI e2e gate now proves the live CopilotKit workspace
  shows `Runtime Status`, `Filing text unavailable`, collector data-directory
  recovery, and downloaded filing-path recovery while preserving the selected
  filing context.
- Added a Playwright-only filing catalog failure hook at the collector query
  boundary. The UI e2e gate now proves the live CopilotKit workspace shows
  `Runtime Status`, `Filing catalog unavailable`, PostgreSQL service recovery,
  and collector schema recovery when the filing catalog cannot be reached.
- Added a Playwright-only selected filing lookup failure hook at the collector
  identity lookup boundary. The two-turn UI e2e gate now proves the workspace
  first selects an Apple 10-K, then preserves that selected filing context while
  showing `Runtime Status`, `Selected filing lookup unavailable`, and
  PostgreSQL recovery guidance when the refresh lookup fails.
- Hardened the LangGraph parser fallback path so parser-only selected filing
  events still receive conservative provenance metadata instead of violating the
  shared state contract.
- Updated the root E2E orchestrator to pipe chatbot dev-server output through a
  narrow line filter that suppresses only the known Next dev
  `Error: aborted`/`ECONNRESET` block caused by intentionally replaced
  CopilotKit long-lived connect streams. Other chatbot stderr/stdout is still
  passed through.

## Verification

Commands run successfully:

- `pnpm --filter @10k/infra run build`
- `pnpm --filter @10k/collector run build`
- `pnpm --filter @10k/collector run typecheck`
- `pnpm --filter @10k/parser run test:unit`
- `pnpm --filter @10k/chatbot run format`
- `pnpm --filter @10k/chatbot run lint`
- `pnpm --filter @10k/chatbot run test:unit`
- `pnpm --filter @10k/chatbot run build`
- `pnpm exec tsx scripts/investment-assistant-runtime-state-smoke.ts` (via
  chatbot `test:unit`)
- `pnpm exec tsx scripts/sec-api-response-smoke.ts` (via chatbot `test:unit`)
- `pnpm install --filter @10k/chatbot --lockfile-only`
- `node --check scripts/project-doctor.mjs`
- `node --check scripts/test-e2e.mjs`
- `pnpm run doctor`
- `bash -n scripts/validate-parser-langgraph-e2e.sh 4-10-k-chat-bot-next/tests/parser-backed-chat-smoke.sh 4-10-k-chat-bot-next/tests/local-sec-chat-fallback-smoke.sh`
- Negative smoke cleanup check with `BASE_URL=http://127.0.0.1:9` for
  `parser-backed-chat-smoke.sh` and `local-sec-chat-fallback-smoke.sh`, followed
  by `/tmp` residue search for `10k-*-chat-smoke.*` and `e2e-chat-payload-*`
- `node -e "JSON.parse(...postman env/collection...)"` for parser Postman
  artifacts
- `pnpm --filter @10k/chatbot run test:unit` after moving TypeScript build info
  to `.next/cache`
- Snapshot comparison around `pnpm --filter @10k/chatbot run test:unit` to
  confirm `next-env.d.ts` is restored after Next type generation
- Live `pnpm run dev` interrupt check to confirm `next-env.d.ts` is restored
  after Next rewrites it for dev route types
- `pnpm run doctor:e2e` followed by `pnpm run doctor` to catch and close the
  e2e runner's own `next-env.d.ts` mutation path
- Targeted collector seed smoke with `--tickers AAPL --since 2025-01-01` to
  verify real SEC metadata and document download flows for a product-demo
  ticker
- `pnpm run doctor:verify`
- `pnpm run doctor:probe` negative-path contract check with services down
- `pnpm run doctor:probe` live-path contract check with infra, collector, parser,
  and chatbot running
- `pnpm run doctor:e2e`
- `pnpm --filter @10k/infra run build`
- `pnpm run infra:up && pnpm --filter @10k/chatbot run db:migrate && pnpm run infra:down`
- `pnpm run build`
- `pnpm run test:unit`
- `pnpm run test:e2e`
- `pnpm --filter @10k/chatbot run lint`
- `pnpm --filter @10k/chatbot run test:unit`
- `node scripts/project-doctor.mjs --json`
- `pnpm run test:e2e` after Data Readiness UX hardening, passing all 19
  Playwright tests with readiness assertions in happy-path, stale freshness, and
  unknown freshness flows

Additional runtime checks:

- Short `pnpm run dev` startup smoke verified collector, parser, and chatbot
  started on `3305`, `3406`, and `3003` without the previous Turbo
  `--parallel` deprecation warning or Turbo update-notifier banner.
- Playwright visual/DOM smoke against `http://127.0.0.1:3003` verified:
  browser title `10-K Investment Copilot`, visible sidebar brand `10-K Copilot`,
  no `Next.js Chatbot Template` text, and no overlap between the CopilotKit
  input box and disclaimer. The final screenshot was captured at
  `/tmp/10k-initial-state-after-layout.png`.
- Runtime-state smoke verified that a simulated parser-runtime failure marks the
  investment workspace as degraded and produces an A2UI `Runtime Status` card
  with recovery guidance for port `3406`.
- Runtime-state smoke also verifies selected filing provenance: `Collector DB`,
  `Downloaded local file`, collector update date, parser status, and freshness
  status are preserved in the A2UI dashboard model.
- Runtime-state smoke verifies stale filing dashboard guidance: `Freshness:
  refresh recommended`, stale collector age detail, and the company sync /
  filing metadata sync / download / parser job refresh hint.
- Runtime-state smoke verifies unknown filing dashboard guidance: `Collector
  updated: unknown`, `Freshness: unknown`, missing timestamp detail, and the
  collector metadata/download job refresh hint.
- Runtime-state smoke verifies the A2UI `Decision Quality` card includes
  decision readiness and all six checks: filing selected, filing freshness,
  filing text, brief evidence, graph evidence, and runtime reliability.
- Runtime-state smoke verifies the A2UI `Data Readiness` card and confirms that
  runtime issues block readiness, current downloaded filings with graph evidence
  are data-ready, and stale/unknown freshness states preserve collector refresh
  guidance as the primary action.
- SEC API response smoke verifies stable structured errors for company miss,
  filing miss, missing local filing file, collector database configuration
  failure, and empty filing-result notices.
- Static project doctor verifies all five numbered targets and reports the local
  package, script, env, runbook, service smoke-path, and cross-target port/env
  contracts. `pnpm run doctor:verify` additionally passed syntax, whitespace,
  infra compose config, chatbot lint, workspace build, and workspace unit gates.
- Live project doctor probe semantics were verified in the down-services case:
  `doctor:probe` exits non-zero and reports concrete recovery commands when
  required local TCP/HTTP endpoints are unavailable.
- Live project doctor probe success was also verified by temporarily starting
  infra, collector, parser, and chatbot, waiting for their health endpoints, and
  passing probes for PostgreSQL, Neo4j Bolt, Neo4j Browser, Loki, Grafana,
  collector, parser, and chatbot. The temporary project services were then
  stopped and the project ports were confirmed clear.
- Live project doctor probe startup behavior was rechecked after observing a
  transient Loki `/ready` `503` immediately after dev stack startup. The
  retrying probe implementation then passed against the same live stack,
  including Loki, Grafana, collector, parser, and chatbot probes.
- SEC API contract coverage now verifies `x-request-id` headers on successful
  and failed API responses, and verifies structured recovery problem payloads
  expose the same request ID operators see in response headers.
- SEC API response smoke coverage now verifies the `sec_api_problem` structured
  warning format and confirms the emitted log includes the same request ID as
  the response.
- Static doctor now verifies collector/parser request logging hooks remain
  present, and the operations runbook documents local and Loki queries for
  `sec_api_problem`, `collector_http_request`, and `parser_http_request`.
- Static doctor now also verifies async job correlation hooks for collector
  job responses, parser collector-parse job lifecycle logs, and parser-to-
  collector `x-request-id` propagation.
- Full release-gate doctor passed with `pnpm run doctor:e2e`. The gate ran
  static doctor checks, doctor syntax, e2e runner syntax, whitespace check,
  infra compose config, chatbot lint, workspace build, workspace unit checks,
  and the full Playwright e2e suite.

The final `pnpm run test:e2e` started infra, migrated the chatbot database,
started collector, parser, and chatbot services, and passed seventeen Playwright
tests: eleven investment-assistant inline panel tests, three SEC API contract
tests, and three admin SEC playground interaction tests. The E2E assertions now
require `Collector DB`, `Collector updated:`, `Parser:`, and `Freshness:` to be
visible in the investment-assistant workspace. They also require `Decision
Quality`, `Brief evidence`, `Graph evidence`, and `Runtime reliability` in the
live investment-assistant UI, while stale and unknown freshness cases must show
a non-ready decision-quality state and the `Filing freshness` check. They also
verify `/api/sec/filings` and `/api/sec/full-text` at HTTP level with
authenticated and unauthenticated request contexts, verify that admin playground
recovery panels render after real button clicks, verify that a parser-runtime
stream failure renders a degraded `Runtime Status` card with port `3406`
recovery guidance, verify that a Graph RAG retrieval failure renders a degraded
`Runtime Status` card with Graph RAG and Neo4j recovery guidance, and verify
that a filing reader
failure renders a degraded `Runtime Status` card with collector data-directory
and downloaded filing-path recovery guidance. The same e2e gate now verifies
that a filing catalog failure renders a degraded `Runtime Status` card with
PostgreSQL service and collector schema recovery guidance, and verifies that a
selected filing lookup failure preserves the selected Apple 10-K context while
rendering PostgreSQL recovery guidance. The same e2e gate now verifies that a
stale collector timestamp renders `Freshness: refresh recommended`, collector
age detail, and refresh job guidance in the live investment assistant UI. It
also verifies that a missing collector timestamp renders `Collector updated:
unknown`, `Freshness: unknown`, timestamp-unavailable detail, and collector
metadata/download job guidance.

The latest Data Readiness e2e pass updated the same Playwright gate to 19 tests
and additionally verifies `Data Readiness`, `Filing catalog`, `Local filing
text`, and `Parser graph` in the investment-assistant UI. Stale and unknown
freshness scenarios must now show readiness action guidance as well as decision
quality warnings.

The latest chatbot build no longer prints the CopilotKit/Express critical
dependency warning. `GET /api/copilotkit/info`,
`POST /api/copilotkit/agent/investment-assistant/connect`, and
`POST /api/copilotkit/agent/investment-assistant/run` were exercised during
e2e and returned valid responses.

The latest chatbot build also no longer prints the previous
`baseline-browser-mapping` age warning. The warning was traced to Next's bundled
compiled `browserslist` data in `next@16.0.10`; upgrading to `next@16.2.9`
removed the warning source.

The latest chatbot dependency resolution no longer prints the previous
`next-auth`, `next-themes`, or `@vercel/otel` peer dependency warnings.

The collector-to-parser ingestion path now filters downloaded reports by
`parserStatus` directly at the collector `downloaded-reports` API. Parser
collector-parse jobs request `parserStatus=""` by default, so already parsed
filings no longer occupy the downloaded-report page and hide unparsed filings
behind them.

Added `pnpm run test:graph-rag` as a real SEC ingestion smoke. It orchestrates
infra, collector, and parser; seeds a target ticker from SEC; writes one
downloaded filing into Neo4j using the deterministic mock extractor; then
verifies `/api/graph-rag/query` returns evidence for that ticker.
`GET /api/auth/session` and guest sign-in redirects were exercised during e2e
after the NextAuth update.

The latest chatbot migration path no longer prints the previous npm unknown env
config warnings. Direct `pnpm --filter @10k/chatbot run db:migrate` was verified
against the local infra database and the root `pnpm run test:e2e` path exercised
the same script.

The latest e2e orchestrator still terminates dev services after tests, but the
normal teardown no longer appears as pnpm recursive run failures. The latest
run also no longer prints the previous Next dev-server
`Error: aborted`/`ECONNRESET` block from replaced CopilotKit connect streams;
the orchestrator filters only that exact known disconnect block.

The latest Playwright run no longer prints the previous `NO_COLOR`/`FORCE_COLOR`
Node warning.

The latest workspace `pnpm run build` no longer prints Next's
`metadataBase property in metadata export is not set` warning.

The latest workspace `pnpm run dev` startup no longer prints Turbo's deprecated
`--parallel` warning or the Turbo update-notifier banner.

Additional collector database checks:

- Existing DB smoke: `GET /api/filings/status-summary` and
  `GET /api/filings?limit=1` returned valid responses after migration-based
  startup.
- Fresh DB smoke: a temporary `sec_collector_migration_smoke` database was
  created, migrations ran on startup, expected tables were present, and empty
  API responses were valid. The temporary database was dropped after the check.

Additional parser runtime hardening:

- Parser collector-parse job status storage now has bounded in-memory retention.
  `PARSER_JOB_STORE_MAX_JOBS` limits retained jobs, and
  `PARSER_JOB_STORE_TTL_SECONDS` evicts terminal job records after the configured
  age. Running jobs are excluded from intentional retention cleanup.
- Parser `/health` now exposes job-store retention stats so live probes and
  operators can verify the active max-job and TTL settings without reading
  process environment.
- Static doctor checks now require the parser env contract and code hooks for
  bounded job-store retention, preventing the async job status store from
  regressing to unbounded growth.

Additional repository hygiene checks:

- Root `.gitignore` now excludes local parser runtime SQLite state
  (`/data/runtime.db`), local development logs (`/logs/`), and Python packaging
  metadata (`*.egg-info/`) so service runs and `uv`/setuptools metadata do not
  pollute release diffs.
- Static doctor now requires those generated-artifact ignore patterns and the
  operations runbook documents the distinction between runtime artifacts and
  source-controlled fixtures/examples.

Additional parser runtime configuration hardening:

- Parser `AppConfig` now resolves default file paths from the `3-10-k-parser`
  package root rather than the caller's current working directory. This keeps
  `RUNTIME_DB_PATH=./data/runtime.db` and
  `MOCK_DOCUMENTS_PATH=./examples/mock_documents.json` stable whether the parser
  is started from the root workspace or from the parser package directory.
- Removed the remaining stale parser self/base URL default
  `http://localhost:3306`; parser config now defaults
  `PARSER_BACKEND_BASE_URL` to `http://localhost:3406`.
- Parser `/health` now reports `runtimeStore.dbPath`, `runtimeStore.threads`,
  and `runtimeStore.runs`, giving operators a direct check for runtime SQLite
  state location and growth.
- Static doctor now verifies parser env defaults, path-root behavior, runtime
  store health hooks, parser package `.gitignore`, and absence of the stale
  `3306` parser default.

Additional parser runtime retention hardening:

- Parser runtime SQLite state now has bounded retention. `RUNTIME_STORE_MAX_THREADS`
  caps retained `runtime_thread` rows, and `RUNTIME_STORE_RETENTION_DAYS` removes
  stale threads with their related `runtime_run` rows.
- Runtime cleanup runs during store initialization, health/stat inspection, and
  runtime store read/write operations, so stale local conversations do not keep
  accumulating between dev and smoke-test sessions.
- Parser `/health` now reports `runtimeStore.maxThreads` and
  `runtimeStore.retentionDays`, and static doctor verifies the env contract plus
  the runtime-store delete hooks.
- Parser runtime SQLite schema now enforces
  `runtime_run.thread_id -> runtime_thread.thread_id` with `ON DELETE CASCADE`,
  enables `PRAGMA foreign_keys` on each connection, and migrates older
  `runtime_run` tables without the cascade relationship while preserving rows
  attached to existing threads.
- Runtime cleanup and stream-resume paths now have explicit indexes:
  `idx_runtime_run_thread_id_created_at` and
  `idx_runtime_thread_updated_at`. Parser `/health` reports
  `runtimeStore.foreignKeyCascade`, and static doctor checks the cascade/index
  hooks.
- Parser `test:unit` now runs `scripts/runtime_store_smoke.py`, covering fresh
  runtime DB creation, legacy `runtime_run` migration, orphan run removal,
  runtime indexes, and parent-thread delete cascade through the normal unit
  gate. Static doctor requires that smoke script so the coverage does not drift.

Additional collector migration documentation hardening:

- Collector README no longer documents TypeORM `synchronize: true` as the DB
  schema path. It now states that the app runs TypeORM migrations at startup and
  that runtime synchronize is disabled.
- Static doctor now verifies the collector README migration wording, rejects the
  stale `synchronize: true` README value, and checks the actual database module
  contract: `migrationsRun: true` plus `synchronize: false`.
- `pnpm run doctor:verify` passed after the documentation/doctor update,
  covering doctor syntax, e2e runner syntax, whitespace, infra compose config,
  chatbot lint, workspace build, and workspace unit checks.

Additional Investment Assistant A2UI schema hardening:

- Replaced the dashboard viewer's `any[]` component boundary with a local
  `InvestmentA2UIComponent` union for the Text, Column, and Card components the
  assistant actually emits.
- Added `normalizeInvestmentA2UISurface` so server-side turn state and
  client-side agent snapshots reject unsupported roots or component shapes
  instead of attempting to render malformed dashboard payloads.
- Removed the `dashboardComponents as any` casts from both the full workspace
  and inline chat-panel dashboard renderers.
- Extended `scripts/investment-assistant-runtime-state-smoke.ts` to assert the
  stable `root` component contract and reject unsupported root/component
  payloads.
- Static doctor now requires the A2UI surface validation helpers and smoke
  coverage. `pnpm --filter @10k/chatbot run test:unit`,
  `pnpm --filter @10k/chatbot run lint`, `node scripts/project-doctor.mjs
  --json`, and `git diff --check` passed after this update.

Additional live doctor probe lifecycle hardening:

- Added `scripts/run-doctor-probe.mjs` and root `doctor:probe:local` so a user
  can run the full live probe gate from a clean shell without manually managing
  infra, app services, DB migration, or cleanup.
- The runner starts infra, runs the chatbot DB migration, launches collector,
  parser, and chatbot, waits for their health/info endpoints, executes
  `pnpm run doctor:probe`, restores `next-env.d.ts`, kills app service ports,
  and runs `pnpm run infra:down`.
- Static doctor now requires `doctor:probe:local` and the lifecycle runner.
  `doctor:verify` also checks `scripts/run-doctor-probe.mjs` syntax.
- `pnpm run doctor:probe:local` passed after this update. The run verified
  PostgreSQL, Neo4j, Loki, Grafana, collector JSON/status shape, parser health
  runtime-store shape, chatbot CopilotKit info, and parser-to-collector
  request ID correlation, then cleaned up project ports and project containers.

Latest browser E2E revalidation:

- `pnpm run doctor:e2e` passed after the live-probe lifecycle work. The gate
  covered doctor syntax, e2e runner syntax, doctor probe runner syntax,
  whitespace, infra compose config, chatbot lint, workspace build, workspace
  unit checks, and `pnpm run test:e2e`.
- The Playwright gate ran 17 tests covering investment assistant inline panels,
  New Chat reset, parser/Graph RAG/filing/catalog degraded states, selected
  filing preservation, stale/unknown freshness guidance, SEC API contracts, and
  SEC playground success/recovery flows.
- The E2E orchestrator restored `next-env.d.ts`, ran `pnpm run infra:down`, and
  left no project app ports or `graph-rag`/`sec-filings` containers running.

Additional Graph RAG evidence quality hardening:

- `scripts/test-parser-collector-graph-rag.mjs` now validates that every
  returned evidence item has a citation label, supported node type, item code,
  selected filing id, company name, positive numeric score, non-empty reason,
  sufficiently long plain text, and no duplicate evidence key.
- The live smoke also requires the answer to include both the resolved focus and
  item citations, while respecting `evidenceLimit=4`.
- The JSON smoke summary now emits `evidencePreview` with citation label, node
  type, item code, score, and text length so evidence quality can be reviewed
  without dumping filing text.
- Static doctor checks now require the Graph RAG smoke to contain the evidence
  quality assertion helper, the evidence limit contract, focus-in-answer
  assertion, and `textLength` preview output.
- `pnpm run test:graph-rag` passed after this hardening with ticker `AAPL`,
  selected filing `acc:0000320193-26-000013`, one successful parse job, 1909
  Neo4j nodes, 4536 relationships, and four scoped Item 1A evidence items with
  text lengths 283, 283, 402, and 274.

Additional SEC API and playground recovery hardening:

- SEC API bad-request paths now use the same structured `SecApiProblem`
  envelope as operator failures. Blank `companyQuery` and malformed JSON/body
  cases return `sec_bad_request`, echo `x-request-id`, include the request id in
  the body, and provide recovery guidance.
- SEC POST schemas now trim company, CIK, accession, risk tolerance, and time
  horizon inputs before validation, so whitespace-only payloads cannot pass as
  valid filing requests.
- The SEC playground now clears loaded filing/full-text/summary/brief state
  when the company input changes. This prevents Summary or Brief from running
  against a stale selected filing after the operator has changed the target
  company.
- The playground also performs local blank-company validation and shows a
  structured `sec_bad_request` panel before sending a request.
- Static doctor now requires the SEC response smoke bad-request contract,
  playground stale-selection prevention hooks, SEC API bad-request e2e
  coverage, and SEC playground stale-selection e2e coverage.
- `pnpm run test:e2e` passed after this hardening with 19 Playwright tests,
  including the new structured bad-request and stale filing selection
  regression cases. The e2e orchestrator ran `pnpm run infra:down` and removed
  the project infrastructure containers.

Additional CI release gate wiring:

- Added `.github/workflows/project-gates.yml` to run the local release gates in
  GitHub Actions.
- Pull requests and `main` pushes run `pnpm run doctor:verify` and
  `pnpm run test:e2e` on Node 24 with the pinned workspace pnpm version and
  frozen lockfile install.
- The live SEC parser-to-Neo4j-to-Graph-RAG smoke remains separated from pull
  request latency and external SEC availability; it runs on the nightly schedule
  and via manual dispatch with `run_graph_rag=true`.
- Static doctor now requires the workflow file, current GitHub Actions setup
  actions, Node 24, frozen pnpm install, `doctor:verify`, `test:e2e`,
  `test:graph-rag`, `workflow_dispatch`, and `schedule`.

## Residual Warnings

- Build, unit, and e2e gates are clean.
- PostgreSQL migration `NOTICE` records for already-existing Drizzle objects are
  expected idempotent database messages.

## Recommended Next Action

Continue product hardening beyond the current doctor gates: review runtime
observability, seed-data refresh workflows, and dashboard/operator telemetry.
Keep both warning filters scoped: webpack filtering should only cover the known
upstream Express `view.js` warning, and E2E output filtering should only cover
the known Next dev `Error: aborted`/`ECONNRESET` disconnect block.
