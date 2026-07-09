# BFF Progress

| Task ID | Status | Owner | Output | Commands | Notes |
|---------|--------|-------|--------|----------|-------|
| BFF-01 | Done | Codex | `apps/bff/src/graphs/graphs.module.ts` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | Graph module wiring |
| BFF-02 | Done | Codex | `apps/bff/src/graphs/adapters/langgraph-runner.adapter.ts` | `pnpm --filter @reason-ball/langgraph-js-bff test` | Dynamic LangGraph invoke/stream/resume adapter |
| BFF-03 | Done | Codex | `apps/bff/src/graphs/graphs.service.ts` | `pnpm --filter @reason-ball/langgraph-js-bff test` | LangSmith metadata/tags added |
| BFF-04 | Done | Codex | `POST /graphs/:id/invoke`, `invoke-graph.dto.ts` | `pnpm --filter @reason-ball/langgraph-js-bff test` | deterministic invoke tested |
| BFF-05 | Done | Codex | `POST /graphs/:id/stream`, `stream-graph.dto.ts` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | NDJSON stream endpoint |
| BFF-06 | Done | Codex | `POST /graphs/:id/resume`, `resume-graph.dto.ts` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | Command resume endpoint |

Verification:

- `pnpm --filter @reason-ball/langgraph-js-bff typecheck`
- `pnpm --filter @reason-ball/langgraph-js-bff test`
- `pnpm --filter @reason-ball/langgraph-js-bff build`
