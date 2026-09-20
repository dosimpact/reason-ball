# Bruno desktop app scripts

- Date: 2026-09-20
- Domain: `shared`
- Context: The BFF and LangGraph packages both contain `bruno-api-tests/` collections but lacked a
  package-local command for opening them in the installed Bruno desktop app.
- Change: Added `pnpm bruno` to `2-bff-apps` and `3-langgraph-fast`. The command opens the package's
  `bruno-api-tests/` directory with the macOS Bruno application.
- Rationale: Keep collection authoring and interactive execution commands discoverable beside each
  owning package.
- Affected stock:
  - `docs/stock/shared/test-design.md` (Bruno collection operation)
- Validation: Both package manifests parse successfully, both collection directories exist, and
  macOS resolves the installed Bruno application.
