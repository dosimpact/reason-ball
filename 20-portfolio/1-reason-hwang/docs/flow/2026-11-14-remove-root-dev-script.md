# 2026-11-14 Remove root dev script

- Scope: tech-shared / workspace; DEV-START-001.
- Context and decision: User requested removal of the root dev script after reviewing its behavior.
- Change: Removed only `scripts.dev` from `package.json`. Launcher files, helper tests, and package-level dev commands remain available.
- Stock: [Workspace commands and development startup](../stock/tech-shared/workspace.md#root-commands) synchronized with the manifest.
- Validation: Parsed the manifest and confirmed `scripts.dev` is absent; `git diff --check` passed. API, View, and business behavior validation policies do not apply to this manifest-only command removal.
- Resources: No servers, browsers, or temporary runtime resources created.
