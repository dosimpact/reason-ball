# 08 Time Travel / Replay UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `time_travel_replay` graph.
- Example navigation includes `08 Time Travel / Replay UI`.

## User Actions

1. Open the app and select `08 Time Travel / Replay UI`.
2. Confirm the default API URL and original topic input are present.
3. Keep the default original topic and click `Run original timeline`.
4. Wait for the original timeline to complete and show `Original Result`.
5. Confirm the original thread id remains visible.
6. Confirm the checkpoint history panel shows multiple checkpoint entries.
7. Select a non-current checkpoint from the checkpoint history list.
8. Confirm selected checkpoint details show checkpoint id and source metadata.
9. Edit either the replay topic or replay instruction input.
10. Click `Replay from selected checkpoint`.
11. Wait for replay completion and review `Replay Result`, `Replay Comparison`, and `Raw Stream Events`.

## Expected UI States

- Status reaches completion for the original timeline before replay controls are used.
- The visible thread facts include a stable original thread id after the original run.
- Checkpoint History lists more than one checkpoint for the original thread.
- Selecting a non-current checkpoint populates Selected Checkpoint with checkpoint id, source, metadata, and state details.
- Replay controls remain tied to the selected checkpoint and allow a changed topic or instruction.
- `Replay from selected checkpoint` produces a replay or fork without hiding the original thread id.
- `Original Result` and `Replay Result` are both visible and have distinguishable content.
- `Replay Comparison` indicates that the replay/fork changed from the original timeline.
- Raw Stream Events is visible and contains streamed original, checkpoint, and replay events.

## Backend Assertions

- `time_travel_replay` streams successfully through the SDK client.
- The graph creates multiple checkpoints during the original timeline run.
- The SDK can list state history for the original thread and select an earlier checkpoint.
- Replay starts from the selected checkpoint configuration rather than from the current state.
- The replay/fork preserves visibility of the original thread id while producing distinguishable replay output.
- Stream events include checkpoint, thread, run, and replay/fork event data.

## Cleanup

- The browser flow may leave in-memory original and replay/fork run data in the dev server.
- No persistent external data is created.
- Test isolation should clear page storage between Playwright tests if the UI stores selected checkpoint or replay metadata locally.
