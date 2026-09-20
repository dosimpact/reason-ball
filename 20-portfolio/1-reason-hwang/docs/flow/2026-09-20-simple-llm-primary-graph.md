# Simple LLM primary graph

- Date: 2026-09-20
- Domain: `shared`
- Context: A minimal primary graph was requested beside `main_graph` for direct LLM execution.
- Change: Added `src/graph/primary_graphs/simple_llm/` with the same package boundaries as
  `main_graph` (`node`, `state`, `workflow`, `prompts`, `tools`, and `mcp`) and registered the
  compiled graph as `simple_llm` in `langgraph.json`. The complete graph owns its ReAct agent and
  Open-Meteo-backed `get_weather` tool, allowing the model to issue tool calls without depending on
  a subgraph package.
- Rationale: Provide a small primary graph for isolated provider and LangGraph runtime testing while
  keeping the established graph package layout.
- Affected stock:
  - `docs/stock/shared/system-design.md` (`FastAPI and LangGraph`)
- Validation:
  - Focused simple graph tests: 2 passed.
  - Full `uv run pytest`: 100 passed, 7 skipped.
  - Standard package import, `simple_llm` graph entry, and graph-owned `get_weather` binding: passed.
  - Ruff for the new graph and tests: passed.
  - `uv run --with pyright pyright`: 0 errors.
  - `uv build`: source distribution and wheel built; the wheel contains the complete `simple_llm`
    structure.
  - `pnpm dev:langgraph`: runtime imported `simple_llm` and completed startup successfully on an
    automatically selected test port.
  - No `simple-llm` path or `graph.subgraph` dependency remains in the primary graph.
  - The installed environment lacks the newer `langchain.agents` package, so the graph uses the
    project's available `langgraph.prebuilt.create_react_agent` API and emits its upstream
    deprecation warning.
