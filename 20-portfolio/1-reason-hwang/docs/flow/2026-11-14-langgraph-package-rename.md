# 2026-11-14 LangGraph package rename

- Scope: tech-shared / 3-langgraph-fast; PKG-NAME-001.
- Context: User requested the pnpm package name `@reason-hwang/langgraph-fast-api` in place of `reason-hwang-langgraph-fast`.
- Change: Updated the package manifest and current README/stock command references. Preserved historical flow records and human-docs. Python distribution and directory names are unchanged.
- Stock: [Workspace](../stock/tech-shared/workspace.md), [test design](../stock/tech-shared/test-design.md), [push UI](../stock/tech-shared/push-ui-message/INDEX.md), [SEC UI](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md).
- Validation: `pnpm -C 20-portfolio/1-reason-hwang --filter @reason-hwang/langgraph-fast-api exec node -p 'require("./package.json").name'` returned the requested name. Scoped `git diff --check` passed. Lockfile has no old-name reference and uses directory-based importer keys; no dependency changes required. API/View/business behavior gates do not apply to package metadata and command documentation changes.
- Cleanup: No servers, browsers, or temporary runtime resources created.
