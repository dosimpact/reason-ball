# GRAPH Progress

Each graph task owns one source file, one TypeScript target file, and any focused smoke coverage.

| Task ID | Status | Owner | Source | Target | Parallel Batch |
|---------|--------|-------|--------|--------|----------------|
| GRAPH-01 | Done | Codex | `graph-basic/01_simple_graph.py` | `apps/bff/src/langgraph-examples/graph-basic/01-simple-graph.ts` | G2 |
| GRAPH-02 | Done | Codex | `graph-basic/02_llm_graph.py` | `apps/bff/src/langgraph-examples/graph-basic/02-llm-graph.ts` | G2 |
| GRAPH-03 | Done | Codex | `graph-basic/03_tool_node.py` | `apps/bff/src/langgraph-examples/graph-basic/03-tool-node.ts` | G2 |
| GRAPH-04 | Done | Subagent Nash | `graph-basic/04_subgraph.py` | `apps/bff/src/langgraph-examples/graph-basic/04-subgraph.ts` | P3 |
| GRAPH-05 | Done | Codex | `graph-basic/05_interrupt.py` | `apps/bff/src/langgraph-examples/graph-basic/05-interrupt.ts` | G2 |
| GRAPH-06 | Done | Subagent Halley | `graph-basic/06_checkpointer.py` | `apps/bff/src/langgraph-examples/graph-basic/06-checkpointer.ts` | P5 |
| GRAPH-07 | Done | Codex | `graph-basic/07_streaming.py` | `apps/bff/src/langgraph-examples/graph-basic/07-streaming.ts` | G2 |
| GRAPH-08 | Done | Subagent Nash | `graph-basic/08_map_reduce.py` | `apps/bff/src/langgraph-examples/graph-basic/08-map-reduce.ts` | P3 |
| GRAPH-09 | Done | Subagent Meitner | `graph-basic/09_structured_output.py` | `apps/bff/src/langgraph-examples/graph-basic/09-structured-output.ts` | P4 |
| GRAPH-10 | Done | Subagent Meitner | `graph-basic/10_rag.py` | `apps/bff/src/langgraph-examples/graph-basic/10-rag.ts` | P4 |
| GRAPH-11 | Done | Subagent McClintock | `graph-basic/11_1_supervisor.py` | `apps/bff/src/langgraph-examples/graph-basic/11-1-supervisor.ts` | P7 |
| GRAPH-12 | Done | Subagent McClintock | `graph-basic/11_2_supervisor.py` | `apps/bff/src/langgraph-examples/graph-basic/11-2-supervisor.ts` | P7 |
| GRAPH-13 | Done | Subagent McClintock | `graph-basic/11_3_supervisor_diff_state.py` | `apps/bff/src/langgraph-examples/graph-basic/11-3-supervisor-diff-state.ts` | P7 |
| GRAPH-14 | Done | Subagent McClintock | `graph-basic/11_4_supervisor_chat_subgraph.py` | `apps/bff/src/langgraph-examples/graph-basic/11-4-supervisor-chat-subgraph.ts` | P7 |
| GRAPH-15 | Done | Subagent McClintock | `graph-basic/12_1_reflection.py` | `apps/bff/src/langgraph-examples/graph-basic/12-1-reflection.ts` | P7 |
| GRAPH-16 | Done | Subagent McClintock | `graph-basic/12_2_reflection.py` | `apps/bff/src/langgraph-examples/graph-basic/12-2-reflection.ts` | P7 |
| GRAPH-17 | Done | Subagent McClintock | `graph-basic/13_plan_and_execute.py` | `apps/bff/src/langgraph-examples/graph-basic/13-plan-and-execute.ts` | P7 |
| GRAPH-18 | Done | Subagent Nash | `graph-basic/14_parallel_branches.py` | `apps/bff/src/langgraph-examples/graph-basic/14-parallel-branches.ts` | P3 |
| GRAPH-19 | Done | Subagent Halley | `graph-basic/15_long_term_memory.py` | `apps/bff/src/langgraph-examples/graph-basic/15-long-term-memory.ts` | P5 |
| GRAPH-20 | Done | Subagent Halley | `graph-basic/16_command_interrupt.py` | `apps/bff/src/langgraph-examples/graph-basic/16-command-interrupt.ts` | P5 |
| GRAPH-21 | Done | Subagent Meitner | `graph-basic/17_configurable.py` | `apps/bff/src/langgraph-examples/graph-basic/17-configurable.ts` | P4 |
| GRAPH-22 | Done | Subagent Halley | `graph-basic/18_custom_streaming.py` | `apps/bff/src/langgraph-examples/graph-basic/18-custom-streaming.ts` | P6 |
| GRAPH-23 | Done | Subagent Nash | `graph-basic/19_retry_policy.py` | `apps/bff/src/langgraph-examples/graph-basic/19-retry-policy.ts` | P3 |
| GRAPH-24 | Done | Subagent Meitner | `graph-basic/20_history_reducer.py` | `apps/bff/src/langgraph-examples/graph-basic/20-history-reducer.ts` | P4 |
| GRAPH-25 | Done | Subagent Meitner | `graph-basic/21_long_context.py` | `apps/bff/src/langgraph-examples/graph-basic/21-long-context.ts` | P4 |
| GRAPH-26 | Done | Subagent McClintock | `graph-basic/22_evaluator_loop.py` | `apps/bff/src/langgraph-examples/graph-basic/22-evaluator-loop.ts` | P7 |
| GRAPH-27 | Done | Subagent McClintock | `graph-basic/23_verification_flow.py` | `apps/bff/src/langgraph-examples/graph-basic/23-verification-flow.ts` | P7 |
| GRAPH-28 | Done | Subagent McClintock | `graph-basic/24_qa_pipeline.py` | `apps/bff/src/langgraph-examples/graph-basic/24-qa-pipeline.ts` | P7 |
| GRAPH-29 | Done | Subagent Halley | `graph-basic/25_approval_system.py` | `apps/bff/src/langgraph-examples/graph-basic/25-approval-system.ts` | P5 |

Smoke coverage:

- `apps/bff/src/langgraph-examples/graph-basic/graph-basic.test.ts`
- `apps/bff/src/langgraph-examples/graph-basic/graph-basic-selected.test.ts`

Verification:

- `pnpm --filter @reason-ball/langgraph-js-bff typecheck`
- `pnpm --filter @reason-ball/langgraph-js-bff test`
- `pnpm --filter @reason-ball/langgraph-js-bff build`
