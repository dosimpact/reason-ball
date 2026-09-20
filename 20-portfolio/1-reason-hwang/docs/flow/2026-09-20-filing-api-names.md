# SEC-API-NAME-001: Rename filing collection APIs by company scope

- Date: 2026-09-20
- Domain: us-corporate-filings
- Context: sync/backfill names hid the selected-company/all-company distinction.
- Change: POST filing-sync-jobs → company-filing-sync-jobs; POST and three GET filing-backfill-jobs routes → all-company-filing-sync-jobs. Old routes removed. Bruno names/URLs and API_SPEC updated. Swagger selected-company response annotation corrected to actual 201.
- Unchanged: parameters, response bodies, job names, service classes, database and run IDs. No upstream URLs changed.
- Stock: [system design](../stock/us-corporate-filings/system-design.md#sec-api-name-001-수집-대상이-드러나는-api-이름).
- Compatibility: old paths return 404; callers must migrate. No direct old-path consumers found in frontend or LangGraph source. Historical flow records retain previous names.
- Scenarios: selected-company POST stores one filing using controlled SEC JSON; bulk POST returns runId using a controlled empty local ZIP; latest/ID/verification return that run; invalid years returns 400; missing run returns 404; all five removed routes return 404. Actual PostgreSQL/Nest HTTP, no external SEC download.
- PASS VAL-API-001: `BRUNO_CLI=<installed CLI 4.1.0 entry> pnpm --filter @reason-hwang/bff-apps test:filing-routes:e2e`; 12 HTTP requests, 12 tests, 12 assertions. Real Nest services and temporary PostgreSQL, only SEC getJson boundary replaced with a deterministic filing payload; bulk uses an empty valid ZIP in an owned temp directory. Verification confirms the stored filing count. Runner also polls bulk completion before cleanup.
- Initial test correction: nonexistent company and out-of-range page both throw existing service errors (HTTP 500), so empty selection was not a valid success fixture. Replaced it with an existing fixture company and controlled SEC response; production error behavior was not changed.
- PASS: build and `pnpm --filter @reason-hwang/bff-apps lint` (tsc --noEmit).
- PASS VAL-BROWSER-001: Playwright MCP Swagger at owned `http://127.0.0.1:52088/docs/sec`; selected-company new label/path and documented 201 visible. Try it out with fixture CIK returned one processed company and one synced filing. Snapshot `.playwright-mcp/page-2026-09-20T13-09-15-027Z.yml`; zero console errors, Swagger deep-link deprecation warning only.
- No pure View changes; Storybook not applicable. Owned server/container/ZIP directory removed. Runtime log: `2-bff-apps/bruno-api-tests/reports/filing-routes.log` (ignored).
- Scope limitation: fixture integration validates route compatibility and actual persistence, not live SEC availability or large archive processing.
- Historical imported Swagger reference under tech-shared retains its original example; current route authority is system-design and src/sec/API_SPEC.md. Existing user changes to other documents/Bruno environments preserved.

- PASS regression: shared runner default company pagination suite 24/24 after fixture-mode extension. Bruno syntax and staged diff checks passed.
