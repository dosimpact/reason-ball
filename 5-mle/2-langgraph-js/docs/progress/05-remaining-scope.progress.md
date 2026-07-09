# Remaining Scope Progress

This file tracks `graph-lectures/` and `graph-advanced/` after Phase 1. External dependency tasks are marked and excluded from the next implementation pass.

Dependency classes:

| Class | Meaning | Next Action |
|-------|---------|-------------|
| Ready | No new external infrastructure beyond the current workspace | Include |
| LLM-only | Uses the existing OpenAI/LangSmith `.env` baseline only | Include |
| External-Optional | Can import with fallback, but the source behavior depends on an external service | Exclude unless stub policy is approved |
| External | Requires additional API, DB, vector store, Docker runtime, HTTP server, webhook, auth/JWT, or sandbox | Exclude |

## Lecture Tasks

| Task ID | Status | Owner | Source | Target | Dependency Class | External Mark | Parallel Batch | Notes |
|---------|--------|-------|--------|--------|------------------|---------------|----------------|-------|
| LECTURE-01 | Done | Codex | `graph-lectures/01_reflection_graph.py` | `apps/bff/src/langgraph-examples/graph-lectures/01-reflection-graph.ts` | LLM-only | None | R0 | Reflection graph with deterministic test seam and Studio/BFF registry entry. |
| LECTURE-02 | Excluded | Unassigned | `graph-lectures/02_react_agent.py` | `apps/bff/src/langgraph-examples/graph-lectures/02-react-agent.ts` | External-Optional | Tavily web search | None | Excluded from next pass because original ReAct behavior includes search. |
| LECTURE-03 | Excluded | Unassigned | `graph-lectures/03_react_function_calling.py` | `apps/bff/src/langgraph-examples/graph-lectures/03-react-function-calling.ts` | External-Optional | Tavily web search | None | Excluded from next pass because source includes current-info search tool. |
| LECTURE-04 | Excluded | Unassigned | `graph-lectures/04_search_agent.py` | `apps/bff/src/langgraph-examples/graph-lectures/04-search-agent.ts` | External | Tavily search API | None | Excluded from next pass; search API is the core graph behavior. |
| LECTURE-05 | Excluded | Unassigned | `graph-lectures/05_reflexion_agent.py` | `apps/bff/src/langgraph-examples/graph-lectures/05-reflexion-agent.ts` | External | Tavily batch search | None | Excluded from next pass; reflexion loop generates and runs web search queries. |
| LECTURE-06 | Excluded | Unassigned | `graph-lectures/06_agentic_rag.py` | `apps/bff/src/langgraph-examples/graph-lectures/06-agentic-rag.ts` | External | Agentic RAG, retriever, optional Tavily web search | None | Excluded from next pass; RAG/search dependency needs separate policy. |

## Advanced Tasks

| Task ID | Status | Owner | Source Module | Target Module | Dependency Class | External Mark | Parallel Batch | Notes |
|---------|--------|-------|---------------|---------------|------------------|---------------|----------------|-------|
| ADV-01 | Excluded | Unassigned | `graph-advanced/01_semantic_cache/` | `apps/bff/src/langgraph-examples/graph-advanced/01-semantic-cache/` | External | Embeddings, semantic cache backend | None | Excluded from next pass; embedding/cache policy needed. |
| ADV-02 | Excluded | Unassigned | `graph-advanced/02_tool_rag/` | `apps/bff/src/langgraph-examples/graph-advanced/02-tool-rag/` | External | Embeddings, tool RAG, vector index | None | Excluded from next pass; RAG/vector selection needed. |
| ADV-03 | Excluded | Unassigned | `graph-advanced/03_async_webhook/` | `apps/bff/src/langgraph-examples/graph-advanced/03-async-webhook/` | External | Webhook server, Postgres, Docker, HTTP callback | None | Excluded from next pass; infra and BFF callback design needed. |
| ADV-04 | Done | Subagent Harvey | `graph-advanced/04_graceful_degradation/` | `apps/bff/src/langgraph-examples/graph-advanced/04-graceful-degradation/` | Ready | Simulated flaky tools only | R1 | Retry, try/except, fallback, and partial graphs implemented with deterministic tests. |
| ADV-05 | Excluded | Unassigned | `graph-advanced/05_code_sandbox/` | `apps/bff/src/langgraph-examples/graph-advanced/05-code-sandbox/` | External | Docker/subprocess sandbox | None | Excluded from next pass; sandbox execution policy needed. |
| ADV-06 | Excluded | Unassigned | `graph-advanced/06_postgres_checkpointer/` | `apps/bff/src/langgraph-examples/graph-advanced/06-postgres-checkpointer/` | External | Postgres checkpointer, Docker | None | Excluded from next pass; database runtime required. |
| ADV-07 | Excluded | Unassigned | `graph-advanced/07_vectordb_rag/` | `apps/bff/src/langgraph-examples/graph-advanced/07-vectordb-rag/` | External | Qdrant, embeddings, BM25/RRF, Docker | None | Excluded from next pass; vector DB and ingestion design needed. |
| ADV-08 | Done | Subagent Euclid | `graph-advanced/08_eval_harness/` | `apps/bff/src/langgraph-examples/graph-advanced/08-eval-harness/` | LLM-only | Existing OpenAI/LangSmith only | R2 | ReAct eval harness, golden dataset, evaluator helpers, and deterministic tests implemented. |
| ADV-09 | Done | Subagent Euclid | `graph-advanced/09_observability/` | `apps/bff/src/langgraph-examples/graph-advanced/09-observability/` | LLM-only | Existing LangSmith tracing only | R2 | Observability graph, metrics helpers, usage extraction, and deterministic tests implemented. |
| ADV-10 | Excluded | Unassigned | `graph-advanced/10_async_sse/` | `apps/bff/src/langgraph-examples/graph-advanced/10-async-sse/` | External | Separate SSE HTTP server/static UI | None | Excluded from next pass; should be designed against NestJS BFF streaming first. |
| ADV-11 | Excluded | Unassigned | `graph-advanced/11_multitenancy/` | `apps/bff/src/langgraph-examples/graph-advanced/11-multitenancy/` | External | Postgres store/checkpointer, JWT, Docker, HTTP server | None | Excluded from next pass; auth/storage architecture needed. |

## Next Work Set

Completed Task IDs in the non-external implementation pass:

- `LECTURE-01`
- `ADV-04`
- `ADV-08`
- `ADV-09`

Excluded Task IDs:

- `LECTURE-02`, `LECTURE-03`, `LECTURE-04`, `LECTURE-05`, `LECTURE-06`
- `ADV-01`, `ADV-02`, `ADV-03`, `ADV-05`, `ADV-06`, `ADV-07`, `ADV-10`, `ADV-11`

## Execution Notes

- R0, R1, and R2 can be assigned to separate subagents after each subagent reads `goal.md` and this file.
- Registry exports, `langgraph.json`, shared test setup, and package scripts are R3 integration work and should be changed by one integrator.
- External or External-Optional tasks must not be implemented unless their dependency policy is explicitly changed.
- Do not record `.env` values in this progress file.

## Verification

Latest package-level verification:

- `pnpm --filter @reason-ball/langgraph-js-bff typecheck` - PASS
- `pnpm --filter @reason-ball/langgraph-js-bff test` - PASS, 8 test files / 30 tests

Latest workspace verification:

- `pnpm --filter @reason-ball/langgraph-js-bff typecheck` - PASS
- `pnpm --filter @reason-ball/langgraph-js-bff test` - PASS
- `pnpm --filter @reason-ball/langgraph-js-bff build` - PASS
- `pnpm --filter @reason-ball/langgraph-js-bff lint` - PASS
- Workspace root verified with `pnpm root -w`: `/Users/studio/workspace/projects/reason-ball/node_modules`

R3 integration updates:

- `apps/bff/src/langgraph-examples/index.ts`
- `langgraph.json`

Registry check:

- `listGraphIds()` count: 37
- Added IDs: `l_01_reflection_graph`, `advanced_04_graceful_degradation`, `advanced_04_graceful_degradation_retry`, `advanced_04_graceful_degradation_try_except`, `advanced_04_graceful_degradation_fallback`, `advanced_04_graceful_degradation_partial`, `advanced_08_eval_harness`, `advanced_09_observability`
