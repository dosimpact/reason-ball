# 04 Streaming UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `streaming_ui` graph.

## User Actions

1. Open the app and select `04 Streaming UI`.
2. Confirm the default API URL and a streaming-related prompt are present.
3. Select each stream mode: `messages`, `updates`, `values`, and `custom`.
4. Click the stream run button for each mode.
5. Wait for `Run complete` after each run.

## Expected UI States

- The mode control exposes all four stream modes.
- `messages` renders token or message output.
- `updates` renders state update payloads.
- `values` renders values snapshots.
- `custom` renders progress events such as phase or progress payloads.
- Raw Stream Events remains visible and records events for every mode.

## Backend Assertions

- `streaming_ui` streams successfully for all four SDK stream modes.
- `messages` emits model token or message chunks.
- `updates` emits partial state updates.
- `values` emits state snapshots.
- `custom` emits graph-authored progress events.

## Cleanup

- The browser flow may leave in-memory threads in the dev server.
- Use UI reset or clear controls only if the Streaming UI exposes them.
