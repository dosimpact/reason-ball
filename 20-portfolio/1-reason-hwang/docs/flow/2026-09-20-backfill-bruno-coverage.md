# SEC backfill Bruno request coverage

- Date: 2026-09-20
- Domain: us-corporate-filings
- Requirement: SEC-BRUNO-001
- Context: Controller exposes 13 REST operations but Bruno contained only 9; all four backfill operations were missing.
- Change: Added `04-backfill-jobs` with POST start and GET latest/status/verification, all with assertions and tests. Added three environment variables to local/dev/staging and documented execution order in the collection.
- Rationale: Keep the request collection aligned with implemented endpoints, preserve the selected run ID, and distinguish asynchronous acceptance and completeness from completion.
- Affected stock: [System design / SEC-BRUNO-001](../stock/us-corporate-filings/system-design.md#sec-bruno-001-bff-rest-요청-컬렉션).

## Scenarios

| ID | Given / When / Then |
| --- | --- |
| SEC-BACKFILL-001 | No active backfill / POST years and refreshArchive / 202 run contract, save runId |
| SEC-BACKFILL-002 | Zero or more historical runs / GET latest / 200 null/empty or valid run; seed ID only when unset |
| SEC-BACKFILL-003 | Selected existing runId / GET run / 200 matching ID and progress counters |
| SEC-BACKFILL-004 | Selected existing runId / GET verification / 200 matching ID, string counters, boolean completeness flags |

## Validation

- PASS: Installed official `@usebruno/lang` 0.39.0 parser parsed all 17 `.bru` files (13 requests, 3 environments, collection).
- PASS: Node `vm.Script` compiled all newly added request scripts and tests.
- PASS: Method/path comparison against `CollectorController` found 13 of 13 explicit REST operations represented, zero missing.
- PASS: Scoped `git diff --check` for changed collection and documents.
- SKIP: Four actual HTTP scenarios were not run. No isolated API/DB/SEC fixture was prepared; starting the configured backfill downloads the bulk SEC archive and changes persisted data. Static checks do not establish runtime E2E success.
- Scope: Request artifacts and documentation only; server contract and implementation unchanged. VAL-API-001 server-change trigger does not apply; the Bruno skill runtime validation phase remains unexecuted.
- Follow-up: Open with `pnpm --filter @reason-hwang/bff-apps bruno`, select a prepared environment, and execute the four requests in sequence. Capture actual HTTP evidence before claiming E2E PASS.
