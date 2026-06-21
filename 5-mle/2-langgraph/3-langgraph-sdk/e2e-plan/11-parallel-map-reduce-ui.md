# 11 Parallel / Map-Reduce UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `parallel_map_reduce` graph.
- Example navigation includes `11 Parallel / Map-Reduce UI`.
- The UI provides a topic or request textarea, sample buttons, and a run button named like `Run map-reduce` or `Run parallel workers`.

## User Actions

1. Open the app and select `11 Parallel / Map-Reduce UI`.
2. Confirm the default API URL and request textarea are present.
3. Confirm at least one sample button is visible.
4. Keep the default request and click the run button.
5. Wait for `Run complete`.
6. Review `Worker Progress`, `Reducer Inputs`, `Reducer Output` or `Final Summary`, `Final State`, and `Raw Stream Events`.

## Expected UI States

- Status changes through the run lifecycle and reaches `Run complete`.
- `Worker Progress` displays at least three worker cards.
- Worker cards have stable worker ids or item labels and statuses such as `pending`, `running`, `done`, `completed`, or `failed`.
- Completed workers show partial result text without relying on a specific completion order.
- `Reducer Inputs` is populated with multiple worker results.
- `Reducer Output` or `Final Summary` is populated with the final combined response.
- `Final State` contains worker result data, reducer data, and final output or summary data.
- `Raw Stream Events` contains update or custom stream chunks that mention worker and reducer activity.

## Backend Assertions

- The SDK client streams against graph id `parallel_map_reduce`.
- The graph emits worker start/progress/completion updates with stable worker ids and item labels.
- Worker events may arrive in nondeterministic order, but reducer input ordering remains stable or explicitly labeled.
- Reducer state includes multiple worker results before producing the final combined output.
- Final graph state includes `worker_results`, reducer state, and final output or summary fields.
- Raw stream event output includes `updates` or `custom` chunks sufficient to inspect worker and reducer transitions.

## Cleanup

- The browser flow may leave in-memory thread and run data in the dev server.
- No persistent external data is created.
- Test isolation should clear page storage between Playwright tests if the UI stores selected sample, worker expansion state, or run results locally.
