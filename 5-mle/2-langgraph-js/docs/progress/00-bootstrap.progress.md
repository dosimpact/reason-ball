# BOOT Progress

| Task ID | Status | Owner | Output | Commands | Notes |
|---------|--------|-------|--------|----------|-------|
| BOOT-01 | Done | Codex | `apps/bff/package.json` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | Single package manifest owns BFF, LangGraph examples, Studio/dev/build/start scripts. |
| BOOT-02 | Done | Codex | `/Users/studio/workspace/projects/reason-ball/pnpm-workspace.yaml` | `pnpm list --filter './5-mle/2-langgraph-js/**' --depth -1 --json` | Root workspace includes the single `@reason-ball/langgraph-js-bff` package under `2-langgraph-js`; nested workspace file removed. |
| BOOT-03 | Done | Codex | `/Users/studio/workspace/projects/reason-ball/turbo.json` | `pnpm --filter @reason-ball/langgraph-js-bff build` | Root Turborepo runs the single BFF workspace package; local `turbo.json` removed. |
| BOOT-04 | Done | Codex | `tsconfig.base.json` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | NodeNext TypeScript base config |
| BOOT-05 | Done | Codex | `apps/bff` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | NestJS BFF scaffolded manually |
| BOOT-06 | Done | Codex | `apps/bff/src/langgraph-examples` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | LangGraph JS local module scaffolded under BFF package. |
| BOOT-07 | Done | Codex | `@langchain/langgraph`, `@langchain/core`, `@langchain/openai` | `pnpm install` | TypeScript pinned to `^5.9.3` |
| BOOT-08 | Done | Codex | `.env`, `.env.example`, `.gitignore` | `.env` copied without printing secrets | `.env` ignored by git |

Verification:

- `pnpm root -w` -> `/Users/studio/workspace/projects/reason-ball/node_modules`
- `pnpm list --filter './5-mle/2-langgraph-js/**' --depth -1 --json`
- `pnpm list --filter @reason-ball/langgraph-js-bff --depth -1 --json`
- `pnpm --filter @reason-ball/langgraph-js-bff build`
- `pnpm --filter @reason-ball/langgraph-js-bff typecheck`
- `pnpm --filter @reason-ball/langgraph-js-bff test`
- `pnpm --filter @reason-ball/langgraph-js-bff lint`

Package manifest check:

- Only `apps/bff/package.json` remains under `2-langgraph-js`.
