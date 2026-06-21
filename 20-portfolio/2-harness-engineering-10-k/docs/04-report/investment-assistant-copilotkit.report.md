# Investment Assistant CopilotKit Completion Report

## Summary

- Feature: `investment-assistant-copilotkit`
- Phase: Report
- Completion: 100%
- Report date: 2026-06-12 KST

The project now has a filing-first investment assistant built into the Next.js chatbot workspace. Users can ask for a company filing, inspect selected filing metadata, see Graph RAG evidence, receive a Bull/Bear/Unknown/Next Checks investment frame, and view a persistent A2UI investment dashboard. Runtime dependency failures are surfaced as recoverable workspace state instead of generic chat errors.
The assistant now also exposes a product-facing Data Readiness layer before
analysis, so users can see whether the filing catalog, local filing text,
parser graph, filing freshness, and runtime dependencies are actually ready.

## Related Documents

- Plan: `docs/01-plan/features/investment-assistant-copilotkit.plan.md`
- Design: `docs/02-design/features/investment-assistant-copilotkit.design.md`
- Analysis: `docs/03-analysis/investment-assistant-copilotkit.analysis.md`
- Project doctor analysis: `docs/03-analysis/project-doctor-2026-06-12.analysis.md`

## Completed Items

- `4-10-k-chat-bot-next` root chat page now opens the CopilotKit investment workspace.
- CopilotKit runtime exposes the `investment-assistant` agent through the Hono runtime route.
- Shared state tracks selected filing, filing ladder, filing reader preview, Graph RAG evidence, investment brief, decision quality, A2UI dashboard, and runtime issues.
- Parser exposes `POST /api/graph-rag/query` and accepts selected filing context.
- The assistant combines collector metadata, local filing files, parser Graph RAG evidence, and filing-reader fallback.
- Parser unit smoke now proves selected-filing Graph RAG retrieval does not leak evidence from another filing and unresolved selected filings do not fall back to unrelated evidence.
- A2UI dashboard now renders Selected Filing, Investment Frame, Decision Quality, Bull Case, Bear Case, Unknowns, Next Checks, Graph Evidence, and Runtime Status.
- A2UI dashboard payloads now have a typed local schema and normalization path, so unsupported roots or component shapes are rejected before rendering.
- Runtime failures for parser streaming, Graph RAG, filing reader, filing catalog, and selected filing refresh are shown with specific recovery instructions.
- Data Readiness is now visible in the right-side workspace, inline chat
  snapshot, and A2UI dashboard. It evaluates filing catalog, local filing text,
  parser graph evidence, filing freshness, and runtime dependency readiness
  with item-level recovery actions.
- SEC admin/API failure states now use structured recovery panels for bad
  requests and clear stale selected filings when the operator changes company
  input.
- Browser e2e coverage exercises happy paths, degraded states, stale freshness, unknown freshness, state reset, and selected filing preservation.

## Quality Metrics

- Plan/design match rate: 100%
- Targeted Unknowns regression checks: passed
- Selected-filing Graph RAG scope regression checks: passed
- Graph RAG evidence quality contract checks: passed
- A2UI dashboard schema normalization smoke: passed
- Data Readiness runtime-state and UI contract checks: passed
- Latest full e2e gate after the Unknowns fix: passed
- Latest full e2e revalidation after probe lifecycle hardening: passed, with 17
  Playwright tests covering inline panels, degraded states, freshness guidance,
  SEC API contracts, and SEC playground flows.
- Latest SEC admin/API recovery hardening e2e: passed, with 19 Playwright
  tests covering structured SEC bad requests and stale playground selection
  clearing.
- Latest Graph RAG smoke with selected-filing evidence scope and evidence
  quality assertions: passed
- Latest live doctor probe recorded in project analysis: passed
- Latest static doctor verification after report-document hardening: passed
- Latest product readiness UX e2e: passed, with 19 Playwright tests asserting
  `Data Readiness`, `Filing catalog`, `Local filing text`, `Parser graph`, and
  stale/unknown freshness action guidance.

## Lessons Learned

- Investment-assistant state must expose not only final stance but also evidence quality, freshness, and operational dependency status.
- A2UI surfaces should be checked against the business frame, not just rendered component existence.
- Selected filing context needs defensive preservation when refresh lookups fail.
- Runtime degradation is more useful when it includes concrete operator recovery commands.
- Users need a data readiness answer before they need a decision-quality answer;
  the former says whether the source pipeline is prepared, while the latter says
  whether the resulting brief can be trusted.

## Next Steps

- Keep the selected-filing Graph RAG scope smoke in parser `test:unit` and the live graph smoke whenever retrieval ranking changes.
- Consider persistent CopilotKit conversation state only after the runtime flow and local doctor gates remain stable.
- Improve Graph RAG ranking quality as more filings are parsed into Neo4j.
- Add saved watchlists/briefs only after readiness and decision quality remain
  stable across live ticker workflows.
