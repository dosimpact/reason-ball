# 20 Observability UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` includes a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `observability` graph.
- Example navigation includes `20 Observability UI`.
- The SDK client streams with both `updates` and `custom` modes.

## User Actions

1. Open the app and select `20 Observability UI`.
2. Confirm the default API URL, `Observable query` textarea, action buttons, and observability panels are present.
3. Use the tool query preset, append a unique E2E marker, and click `Run observable graph`.
4. Wait for the OpenAI-backed run to complete and populate `Final Answer`.
5. Review metrics, node timings, token/cost panels, trace links, metadata, observability events, final state, and raw stream events.

## Expected UI States

- `Run Metrics` shows completion status and overall latency/duration.
- `Node Timings` renders at least one node row with elapsed time or latency.
- `Token Usage` renders total/input/output token labels; unavailable values appear as `unknown`.
- `Cost Estimate` renders cost labels and treats unavailable provider cost data as `unknown`.
- `Trace Links` renders LangSmith/trace anchors when configured, otherwise an explicit unavailable/not configured state.
- `Run Metadata` shows run/thread/graph/model/provider metadata for the `observability` graph.
- `Observability Events` shows custom observability lifecycle events.
- `Final Answer` contains a non-empty assistant response.
- `Final State` includes `node_timings`, `token_metrics`, `cost_summary`, `run_metadata`, `trace_links`, `observability_events`, `answer`, and `final`.
- `Raw Stream Events` shows both `updates` and `custom` events.

## Backend Assertions

- Stream requests target graph id `observability`.
- Stream mode includes `updates` and `custom`.
- The request input contains the unique E2E query marker.
- Final graph state includes all required observability keys.
- Token and cost metadata may be numeric or `unknown`; tests do not treat missing metadata as zero.
- When token metadata is present, input/output token labels remain visible.

## Cleanup

- Each test clears page storage before selecting the example.
- Each run uses a unique query marker.
- `Reset` is available for manual cleanup; automated cleanup relies on isolated thread/run state.
