# CORE Progress

| Task ID | Status | Owner | Source | Target | Commands | Notes |
|---------|--------|-------|--------|--------|----------|-------|
| CORE-01 | Done | Codex | `common/llm.py` | `packages/langgraph-examples/src/common/llm.ts` | `pnpm --filter @reason-ball/langgraph-examples typecheck` | OpenAI model alias factory |
| CORE-02 | Done | Codex | `common/tools.py` | `packages/langgraph-examples/src/common/tools.ts` | `pnpm --filter @reason-ball/langgraph-examples test` | `get_current_time`, `calculate`, `lookup_info` |
| CORE-03 | Done | Codex | `node/llm_node.py` | `packages/langgraph-examples/src/node/llm-node.ts` | `pnpm --filter @reason-ball/langgraph-examples typecheck` | Messages model node factory |
| CORE-04 | Done | Codex | `node/routing.py` | `packages/langgraph-examples/src/node/routing.ts` | `pnpm --filter @reason-ball/langgraph-examples typecheck` | tool-call router |
| CORE-05 | Done | Codex | `node/tool_node.py` | `packages/langgraph-examples/src/node/tool-node.ts` | `pnpm --filter @reason-ball/langgraph-examples typecheck` | ToolNode wrapper |
| CORE-06 | Done | Codex | `langgraph.json` | `packages/langgraph-examples/src/index.ts`, `langgraph.json` | `pnpm build` | all 29 basic graphs registered |

Verification:

- `pnpm --filter @reason-ball/langgraph-examples typecheck`
- `pnpm --filter @reason-ball/langgraph-examples test`
- `pnpm build`
