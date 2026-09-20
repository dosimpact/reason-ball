# OAuth Proxy README and Bruno Collection Reconciliation

- Date: 2026-09-20
- Context: The package README still referenced obsolete paths, models, ports, and script names, while the Bruno collection's shared request and logging behavior needed to match the current suite.
- Change:
  - Rewrote the package README around the implemented OAuth, local process, Docker Compose, API, validation, dependency, cleanup, and security behavior.
  - Documented the distinction between local port `18741` and the standalone Compose default host port `2890`.
  - Added a shared JSON `Accept` header and structured post-response diagnostics to `api-test/collection.bru`.
  - Synchronized the OAuth proxy validation section of `docs/stock/test-design.md` with the current package scripts and Bruno coverage.
- Rationale: Make the primary onboarding document and executable API collection agree with the current source and package commands.
- Affected stock sections: `docs/stock/test-design.md` — OAuth proxy validation.
- Validation:
  - `pnpm test:api`: PASS — 3/3 requests, 3/3 tests, and 12/12 assertions passed against the live OAuth upstream.
  - `pnpm test:unit`: PASS — 17 tests passed.
  - `pnpm lint`: PASS.
  - `pnpm typecheck`: PASS.
  - README local-link checks and `git diff --check`: PASS.
