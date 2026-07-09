# CORE Progress

| Task ID | Status | Owner | Source | Target | Commands | Notes |
|---------|--------|-------|--------|--------|----------|-------|
| CORE-01 | Done | Codex | `common/llm.py` | `apps/bff/src/langgraph-examples/common/llm.ts` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | OpenAI model alias factory |
| CORE-02 | Done | Codex | `common/tools.py` | `apps/bff/src/langgraph-examples/common/tools.ts` | `pnpm --filter @reason-ball/langgraph-js-bff test` | `get_current_time`, `calculate`, `lookup_info` |
| CORE-03 | Done | Codex | `node/llm_node.py` | `apps/bff/src/langgraph-examples/node/llm-node.ts` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | Messages model node factory |
| CORE-04 | Done | Codex | `node/routing.py` | `apps/bff/src/langgraph-examples/node/routing.ts` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | tool-call router |
| CORE-05 | Done | Codex | `node/tool_node.py` | `apps/bff/src/langgraph-examples/node/tool-node.ts` | `pnpm --filter @reason-ball/langgraph-js-bff typecheck` | ToolNode wrapper |
| CORE-06 | Done | Codex | `langgraph.json` | `apps/bff/src/langgraph-examples/index.ts`, `langgraph.json` | `pnpm --filter @reason-ball/langgraph-js-bff build` | all 29 basic graphs registered |

Verification:

- `pnpm --filter @reason-ball/langgraph-js-bff typecheck`
- `pnpm --filter @reason-ball/langgraph-js-bff test`
- `pnpm --filter @reason-ball/langgraph-js-bff build`
