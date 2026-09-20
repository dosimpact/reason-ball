# SEC-COMPANIES-PAGE-002: Raise company page size limit

- Date: 2026-09-20
- Domain: us-corporate-filings
- Request: Raise the company listing maximum to 100000.
- Change: Company controller/service limit and Swagger maximum raised from 500 to 100000. Default remains 50; limit alias and pagination semantics remain unchanged.
- Stock: [System design](../stock/us-corporate-filings/system-design.md). API_SPEC updated. Supersedes only the maximum recorded in SEC-COMPANIES-PAGE-001.
- Scenarios: pageSize=100000 and limit=100000 accepted; pageSize=100001 capped to 100000; existing pagination and invalid-input scenarios remain valid.
- PASS VAL-API-001: `BRUNO_CLI=<installed CLI 4.1.0 entry> pnpm --filter @reason-hwang/bff-apps test:companies:e2e` built successfully; 24 requests/tests/assertions passed. Log: `2-bff-apps/bruno-api-tests/reports/company-pagination.log` (ignored).
- PASS VAL-BROWSER-001: Playwright MCP Swagger Try it out at owned `http://127.0.0.1:51849/docs/sec`; pageSize=100000 returned HTTP 200 and pagination.pageSize=100000. Snapshot `.playwright-mcp/page-2026-09-20T13-04-30-117Z.yml`. Console: zero errors; one Swagger deep-link deprecation warning.
- Tests use five fixture companies, verifying the parameter contract, not 100000-row performance. No View change; Storybook not applicable. Owned container/API cleaned up; unrelated files preserved.
- PASS: scoped diff whitespace check.
