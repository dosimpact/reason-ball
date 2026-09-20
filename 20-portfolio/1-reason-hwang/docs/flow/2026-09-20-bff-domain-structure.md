# BFF-STRUCTURE-001: Domain-first source layout and responsibility separation

- Date: 2026-09-20
- Domain: us-corporate-filings / tech-shared BFF
- Request: shared config under src/shared, features under src/{domain-feature}; remove proxy import, extract input parsing and pure normalization, split query responsibilities, validate configuration at startup.
- Design: src/shared/config; src/us-corporate-filings/{api,companies,filings,persistence,integrations/sec,domain}; src/remote-delivery. Keep the /api/sec public prefix, current endpoints, DB schema and migration identity unchanged.
- Input policy: Nest custom pipes produce typed normalized inputs; preserve historical integer coercion for existing filing requests and strict company pagination validation. Share pure formatting while retaining boundary-specific error messages.
- Config: parse environment once on construction with strict numeric/range and URL validation, preserve documented defaults; no secret values in errors. PORT precedes APP_PORT, default 2801 matching the actual server bootstrap.
- Validation plan: existing regression tests; pure normalization/config/request pipe edge tests; real Nest/PostgreSQL Bruno company and filing suites extended to query/download/parser flows; Swagger MCP execution. No live production data or SEC download required.
- Status: implementation in progress.
