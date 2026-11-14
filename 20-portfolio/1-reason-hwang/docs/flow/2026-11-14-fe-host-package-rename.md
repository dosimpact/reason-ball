# 2026-11-14 Frontend host package rename

- Scope: tech-shared / 1-fe-host; PKG-NAME-002.
- Context: User requested the scoped package name `@reason-hwang/fe-host`.
- Change: Renamed the pnpm package and updated root start/test:e2e filters and current command documentation. Directory, existing Codebase Memory index names, historical records, and human-docs remain unchanged.
- Stock: [Workspace](../stock/tech-shared/workspace.md), [test design](../stock/tech-shared/test-design.md), [Storybook](../stock/tech-shared/1-fe-host/storybook.md), [SEC UI](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md), [push UI](../stock/tech-shared/push-ui-message/INDEX.md).
- Validation: pnpm filter returned `@reason-hwang/fe-host`; Turbo start dry run resolved the renamed package. Scoped diff whitespace checks passed. Lockfile has no old-name references; no dependencies changed. No API, View, or business behavior changed, so their runtime gates do not apply.
- Cleanup: Removed the dry-run JSON from /tmp. No servers or browsers started.
