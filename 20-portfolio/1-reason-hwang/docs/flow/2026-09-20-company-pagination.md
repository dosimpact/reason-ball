# SEC-COMPANIES-PAGE-001: Company pagination

- Date: 2026-09-20
- Domain: us-corporate-filings
- Request: Add pagination to company listing while preserving existing limit requests.
- Design: page defaults to 1; pageSize defaults to 50 and caps at 500; explicit pageSize takes precedence over limit. Return filtered totalItems, totalPages, hasNextPage and effective page/pageSize. Keep filters.limit as effective pageSize.
- Ordering: updated_at DESC, cik ASC. Offset pages allow direct page access consistently with the existing report API. Deep offsets may be slower, and concurrent writes may move rows between requests; cursor/snapshot pagination is outside this change.
- Validation plan: real Nest HTTP + isolated PostgreSQL fixtures; first/second/last/out-of-range/empty/filtered pages, alias precedence, max size, malformed input and safe offset boundary. Browser MCP verifies Swagger interaction.
- Affected stock: [system design](../stock/us-corporate-filings/system-design.md).
- PASS VAL-API-001: `BRUNO_CLI=<installed @usebruno/cli@4.1.0 entry> pnpm --filter @reason-hwang/bff-apps test:companies:e2e`; 22 HTTP requests, 22 tests, 22 assertions passed against real Nest + isolated PostgreSQL 16. Includes pageSize precedence, combined q/page filter, normalized ticker/CIK, tied timestamps, empty/out-of-range, 10 invalid-input cases. No SEC calls required for company reads.
- Log: `2-bff-apps/bruno-api-tests/reports/company-pagination.log` (ignored runtime artifact).
- PASS VAL-BROWSER-001: Playwright MCP opened owned Swagger at `http://127.0.0.1:51429/docs/sec`, clicked companies / Try it out / Execute. page=2&pageSize=2 returned CIK 3,4 and pagination {page:2,pageSize:2,totalItems:5,totalPages:3,hasNextPage:true}. page=0 returned 400 with a clear error. Console contained only the expected 400 resource error. Snapshot evidence: `.playwright-mcp/page-2026-09-20T13-02-03-323Z.yml` and `page-2026-09-20T13-02-12-347Z.yml` in the MCP artifact area.
- Harness correction: Initial Swagger navigation returned 404 because Swagger was registered after app.init; moved registration before initialization and reran browser checks successfully.
- PASS: `pnpm --filter @reason-hwang/bff-apps test` (10 existing regression tests); `pnpm --filter @reason-hwang/bff-apps lint` (tsc --noEmit); build passed including final E2E rerun.
- Pure View/Storybook: not applicable; no View components changed.
- Cleanup: owned servers and temporary Docker containers removed; existing development server, local DB and user-edited environment left untouched.
- Skills: apb-bruno-api-tests (HTTP scenarios), supabase-postgres-best-practices (query/fixture review), apb-playwright-e2e (MCP Swagger interaction).
- Preserved user edits: existing Bruno request URL/query selections and local environment. Removed assertions that incorrectly required disabled optional filters.
- Compatibility: valid limit requests preserved; malformed limit inputs now fail strictly instead of parseInt coercion. totalItems and page rows are separate DB statements, not a shared snapshot under concurrent updates.
