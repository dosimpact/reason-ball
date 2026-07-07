# BOOT Progress

| Task ID | Status | Owner | Output | Commands | Notes |
|---------|--------|-------|--------|----------|-------|
| BOOT-01 | Done | Codex | `package.json` | `pnpm install`, `pnpm studio` | root Studio/dev/build/start scripts added; Studio uses `langgraphjs` binary |
| BOOT-02 | Done | Codex | `pnpm-workspace.yaml` | `pnpm install` | apps/packages workspace configured |
| BOOT-03 | Done | Codex | `turbo.json` | `pnpm build` | build/typecheck/test/lint pipeline configured |
| BOOT-04 | Done | Codex | `tsconfig.base.json` | `pnpm typecheck` | NodeNext TypeScript base config |
| BOOT-05 | Done | Codex | `apps/bff` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | NestJS BFF scaffolded manually |
| BOOT-06 | Done | Codex | `packages/langgraph-examples` | `pnpm --filter @reason-ball/langgraph-examples typecheck` | LangGraph JS package scaffolded |
| BOOT-07 | Done | Codex | `@langchain/langgraph`, `@langchain/core`, `@langchain/openai` | `pnpm install` | TypeScript pinned to `^5.9.3` |
| BOOT-08 | Done | Codex | `.env`, `.env.example`, `.gitignore` | `.env` copied without printing secrets | `.env` ignored by git |

Verification:

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
