# Investment Assistant CopilotKit Check Analysis

## Summary

- Feature: `investment-assistant-copilotkit`
- Phase: Check
- Match rate: 100%
- Analysis date: 2026-06-12 KST
- Scope:
  - `3-10-k-parser` Graph RAG API
  - `4-10-k-chat-bot-next` CopilotKit runtime, AG-UI state, A2UI dashboard, and e2e tests
  - `2-10-k-collector` filing metadata and local file dependencies used by the assistant

The implementation now satisfies the plan/design requirements for a filing-first investment assistant. The final product gap found during this Check pass was that the A2UI dashboard exposed Bull Case, Bear Case, and Next Checks but did not explicitly render the `unknowns` portion of the required Bull/Bear/Unknown/Next Checks framework. That gap was fixed in the dashboard model, assistant response text, and regression checks.

## Design-To-Code Match

| Design Item | Evidence | Status |
| --- | --- | --- |
| Root chat page opens the CopilotKit investment workspace | `4-10-k-chat-bot-next/app/(chat)/page.tsx` renders `InvestmentAssistantWorkspace` | Match |
| CopilotKit runtime routes to `investment-assistant` | `4-10-k-chat-bot-next/app/api/copilotkit/[[...slug]]/route.ts` registers `LangGraphHttpAgent` for `investment-assistant` | Match |
| Workspace keeps AG-UI state visible outside the transcript | `components/investment-assistant-workspace.tsx` reads `useAgent` state and renders persistent filing, evidence, decision quality, runtime, and A2UI panels | Match |
| Parser exposes structured Graph RAG API | `3-10-k-parser/src/parser/api/graph_rag_router.py` exposes `POST /api/graph-rag/query`; `api/models.py` defines `GraphRagQueryRequest` | Match |
| Next.js calls Graph RAG with selected filing context | `lib/investment-assistant/graph-rag.ts` sends `selectedFiling`, ticker, CIK, accession, and evidence limit | Match |
| Filing reader and Graph RAG are combined into one investment state | `lib/investment-assistant/server.ts` resolves filings, loads filing text, queries Graph RAG, builds brief, and stores shared state | Match |
| Bull/Bear/Unknown/Next Checks framework is visible | `lib/investment-assistant/dashboard.ts` now renders Bull Case, Bear Case, Unknowns, and Next Checks; `server.ts` includes the same frame in response text | Match |
| Runtime degradation is visible and recoverable | `runtime.ts`, `dashboard.ts`, `langgraph-http/route.ts`, and e2e failure hooks surface parser, graph, filing-reader, filing-catalog, and selected-filing lookup failures | Match |
| A2UI dashboard renders from tool/state output | `components/a2ui-investment-viewer.tsx` renders the A2UI surface; `dashboard.ts` emits A2UI operations | Match |
| Browser e2e covers happy path and degraded states | `tests/e2e/investment-assistant-inline-panels.test.ts` covers inline panels, reset, runtime failures, graph failures, filing text/catalog failures, selected lookup failure, and freshness warnings | Match |

## Gap Closed In This Pass

### Unknowns not visible in the A2UI investment frame

- Category: Missing in Code
- Requirement: Users can request an investment decision brief framed as Bull / Bear / Unknown / Next Checks.
- Before: `unknowns` existed in `InvestmentDecisionBrief`, but the A2UI dashboard only rendered Bull Case, Bear Case, and Next Checks.
- Fix:
  - Added an `Unknowns` card to `buildInvestmentDashboard`.
  - Added `Unknowns:` to the assistant response text in `composeAssistantResponse`.
  - Updated the custom chat panel description to name unknowns.
  - Added `Unknowns` expectations to investment-assistant e2e scenarios.
  - Added runtime-state smoke assertions that the A2UI dashboard contains Bull Case, Bear Case, Unknowns, and Next Checks.

## Verification Evidence

Targeted checks after the Unknowns fix:

```bash
pnpm --filter @10k/chatbot exec biome check lib/investment-assistant/dashboard.ts lib/investment-assistant/server.ts components/investment-assistant-chat-panels.tsx scripts/investment-assistant-runtime-state-smoke.ts tests/e2e/investment-assistant-inline-panels.test.ts
pnpm --filter @10k/chatbot exec tsx scripts/investment-assistant-runtime-state-smoke.ts
pnpm --filter @10k/chatbot run test:unit
pnpm --filter @10k/parser run test:unit
pnpm run doctor:verify
pnpm run doctor:e2e
```

All checks passed. The final `doctor:e2e` run included the full workspace static verification, build, unit checks, and seventeen Playwright e2e tests. The first three investment-assistant e2e scenarios now require `Unknowns` in the rendered workspace, so the Bull/Bear/Unknown/Next Checks frame is covered by browser-level evidence.

Follow-up Graph RAG scoping hardening:

- Added `3-10-k-parser/scripts/retrieval_scope_smoke.py` to prove selected filing retrieval passes the resolved filing id to evidence queries and does not leak distractor evidence.
- Added an unresolved selected filing case that returns no evidence instead of silently falling back to an unrelated filing.
- Strengthened `scripts/test-parser-collector-graph-rag.mjs` so the live parser/collector/Neo4j smoke requires every returned evidence item to match `selectedFiling.filingId`.
- Clarified the risk and metric Cypher `WHERE` clauses so filing scope and item-code filtering are grouped explicitly.
- Re-ran `pnpm run test:graph-rag` after the scoping assertion. It passed with ticker `AAPL`, selected filing `acc:0000320193-26-000013`, 1 parsed filing, 1909 written nodes, 4536 written relationships, and 4 scoped evidence items.

Follow-up Graph RAG evidence quality hardening:

- Extended `scripts/test-parser-collector-graph-rag.mjs` so the live Graph RAG
  smoke now validates evidence citation labels, node types, item codes,
  selected filing ids, company names, positive scores, reasons, plain-text
  excerpts, minimum text length, and duplicate prevention.
- The live smoke requires the answer to preserve the resolved focus and item
  citations while keeping the result bounded by `evidenceLimit=4`.
- The smoke summary now includes `evidencePreview` entries with citation label,
  node type, item code, score, and text length.
- Re-ran `pnpm run test:graph-rag` after the evidence-quality assertions. It
  passed with selected filing `acc:0000320193-26-000013`, 1909 written nodes,
  4536 written relationships, and four scoped Item 1A evidence items:
  SectionText score 1.00 length 283, Risk score 0.92 length 283, Risk score
  0.84 length 402, and Risk score 0.76 length 274.

Follow-up A2UI dashboard schema hardening:

- Added a local `InvestmentA2UIComponent` union and `InvestmentA2UIRootId`
  contract for the Text, Column, Card, and root components the dashboard emits.
- Added `normalizeInvestmentA2UISurface` and applied it when restoring
  server-side assistant state and client-side agent snapshots, so malformed
  dashboard payloads are discarded instead of rendered.
- Removed the remaining `dashboardComponents as any` casts from the workspace
  and inline chat-panel A2UI renderers.
- Extended `scripts/investment-assistant-runtime-state-smoke.ts` to verify the
  stable `root` card and reject unsupported root/component payloads.
- Verification after this hardening:
  `pnpm --filter @10k/chatbot run test:unit`,
  `pnpm --filter @10k/chatbot run lint`,
  `node scripts/project-doctor.mjs --json`, and `git diff --check` passed.

Follow-up SEC API and playground recovery hardening:

- Routed blank filing-list queries and malformed SEC POST bodies through
  `toSecApiErrorResponse`, so bad requests now return the structured
  `SecApiProblem` envelope with code `sec_bad_request`, request id, cause, and
  recovery guidance.
- Trimmed full-text, summary, and investment-brief POST request fields before
  validation to reject whitespace-only company, CIK, and accession inputs.
- Updated the SEC playground to clear filing/full-text/summary/brief state when
  the company input changes, preventing Summary or Brief from using a stale
  selected filing after the operator changes target company.
- Added local playground validation for blank company input with a structured
  `sec_bad_request` recovery panel.
- Extended `scripts/sec-api-response-smoke.ts`, `tests/e2e/sec-api-contract.test.ts`,
  `tests/e2e/sec-playground.test.ts`, and static doctor checks for these
  contracts.
- Verification after this hardening:
  targeted `biome check`, `pnpm --filter @10k/chatbot run test:unit`,
  `node scripts/project-doctor.mjs --json`, `git diff --check`, and
  `pnpm run test:e2e` passed. The Playwright gate now runs 19 tests and covers
  structured SEC bad requests plus stale playground selection clearing.

Follow-up product readiness UX hardening:

- Added a shared `buildInvestmentDataReadiness` model that evaluates whether
  filing catalog, local filing text, parser graph evidence, filing freshness,
  and runtime dependencies are ready before the user relies on an analysis.
- Added a `Data Readiness` card to the right-side investment workspace and the
  inline chat workspace snapshot, with item-level status and concrete recovery
  actions for missing metadata, missing local files, stale freshness, parser
  graph gaps, and runtime failures.
- Added the same `Data Readiness` section to the A2UI dashboard model so the
  transcript, side panel, and structured dashboard agree on data readiness.
- Prioritized freshness recovery as the primary action when collector metadata
  is stale or unknown, so the product guides users to refresh source data before
  asking them to improve citations.
- Extended runtime-state smoke, static doctor contracts, and Playwright e2e
  coverage to require `Data Readiness`, `Filing catalog`, `Local filing text`,
  and `Parser graph` in the product UI.
- Verification after this hardening:
  `pnpm --filter @10k/chatbot run lint`,
  `pnpm --filter @10k/chatbot run test:unit`,
  `node scripts/project-doctor.mjs --json`, and `pnpm run test:e2e` passed.
  The full Playwright gate passed 19 tests and now asserts readiness guidance
  in happy-path, stale freshness, and unknown freshness flows.

Broader gates already established in `docs/03-analysis/project-doctor-2026-06-12.analysis.md`:

- `pnpm run doctor:e2e`
- `pnpm run test:graph-rag`
- `DOCTOR_PROBE_ATTEMPTS=30 DOCTOR_PROBE_DELAY_MS=1000 pnpm run doctor:probe`
- `pnpm run doctor:verify`
- `pnpm --filter @10k/parser run test:unit`

## Residual Risks

- Graph evidence quality still depends on available parsed filings and Neo4j graph coverage.
- CopilotKit conversation persistence remains out of scope; the workspace state is thread-scoped runtime state.
- The investment frame is a decision-support artifact, not a valuation model or investment recommendation.

## Decision

The feature is ready to move from Check to Report. The remaining work is product hardening beyond the planned scope, not a plan/design mismatch.
