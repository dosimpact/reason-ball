# Codebase Memory Todo Lab

This app is a small fixture for measuring structural code analysis.

- Keep the single `package.json` architecture.
- Preserve the client -> HTTP -> controller -> service -> repository layers.
- Use codebase-memory-mcp for initial structural queries when it is available.
- Verify graph results with source reads, `rg`, types, and tests.
- Mark inferred HTTP or React relationships separately from proven call edges.
- After edits, run `pnpm --filter @reason-ball/codebase-memory-todo typecheck`,
  `test`, and `build`.
