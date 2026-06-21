# 32 Chat Graph Execution Canvas E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934`.
- The LangGraph server exposes the `chat_graph_execution_canvas` graph.
- Example navigation includes `32 Chat + Graph Execution Canvas`.
- The SDK client streams with `streamMode: ["updates", "custom"]`.

## User Actions

1. Open the app and select `32 Chat + Graph Execution Canvas`.
2. Confirm the API URL, debugger prompt, run, reset, event inspection, replay controls, and result panels are present.
3. Enter a unique marker in the debugger prompt.
4. Click `Run graph canvas`.
5. Wait for the debugger canvas, graph nodes, event list, checkpoints, state diff, canvas events, and final state.
6. Select `evt-5` in the event inspector.
7. Click `Inspect selected event`.
8. Wait for selected status and version `v2`.
9. Click `Time travel replay`.
10. Wait for replayed status, replay summary, and version `v3`.

## Expected UI States

- `Graph Execution Canvas` renders stable graph nodes and edges.
- `Event Inspector` exposes events `evt-1` through `evt-6`.
- `Checkpoint Timeline` shows `cp-1` through `cp-3`.
- `State Diff` updates for the selected event.
- `Time Travel Replay` reports replay context from the selected checkpoint.
- `Version History` records inspect, select, and replay actions.

## Backend Assertions

- Stream requests target graph id `chat_graph_execution_canvas`.
- Stream mode includes `updates` and `custom`.
- The first request includes the marker and `action: "inspect"`.
- Follow-up requests include `action: "select_event"` and `action: "time_travel"` with `selected_event_id: "evt-5"`.
- Final graph state reports `final_status: "replayed"` and artifact version `3`.

## Cleanup

- Each test clears browser storage before selecting the example.
- The graph stores debugger artifacts in LangGraph thread state only.
