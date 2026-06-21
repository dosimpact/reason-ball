# 10 Subgraph / Nested Execution UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `subgraph_nested_execution` graph.
- Example navigation includes `10 Subgraph / Nested Execution UI`.
- The UI provides a request textarea, sample buttons including a sales/report-style sample, and a run button named like `Run nested graph`.

## User Actions

1. Open the app and select `10 Subgraph / Nested Execution UI`.
2. Confirm the default API URL and request textarea are present.
3. Confirm a sales/report-style sample button is visible.
4. Keep the default request and click `Run nested graph`.
5. Wait for `Run complete`.
6. Review `Nested Execution Tree`, `Breadcrumb`, `Parent State`, `Subgraph State` or `Subgraph Details`, `Final State`, and `Raw Stream Events`.
7. Expand at least one subgraph details area if it is collapsed.

## Expected UI States

- Status changes through the run lifecycle and reaches `Run complete`.
- `Nested Execution Tree` shows parent and subgraph execution nodes.
- At least one subgraph details area is present and can be expanded or is already expanded.
- `Breadcrumb` displays a nested path such as `supervisor > team > worker`, `parent > subgraph`, or equivalent parent/subgraph path text.
- `Parent State` is populated with parent-level request, routing, supervisor, or final coordination data.
- `Subgraph State` or `Subgraph Details` is populated with subgraph, team, worker, or child execution data.
- `Final State` contains nested trace data that distinguishes parent and subgraph execution.
- `Raw Stream Events` contains stream updates and metadata for the nested run.
- The representative sales/report sample completes and keeps parent/subgraph panels populated.

## Backend Assertions

- The SDK client streams against graph id `subgraph_nested_execution`.
- Nested stream metadata includes path information for parent and subgraph events.
- Parent graph events and subgraph events are both represented in the emitted stream.
- Final graph state includes nested trace data, parent state data, and subgraph state data.
- Raw stream event output includes update chunks and metadata chunks sufficient to reconstruct the nested execution path.

## Cleanup

- The browser flow may leave in-memory thread and run data in the dev server.
- No persistent external data is created.
- Test isolation should clear page storage between Playwright tests if the UI stores selected sample, expanded tree state, or run results locally.
