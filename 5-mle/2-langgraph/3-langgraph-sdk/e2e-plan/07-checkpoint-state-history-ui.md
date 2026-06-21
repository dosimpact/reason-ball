# 07 Checkpoint / State History UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `checkpoint_state_history` graph.

## User Actions

1. Open the app and select `07 Checkpoint / State History UI`.
2. Confirm the default API URL and prompt/topic input are present.
3. Keep the default prompt and click `Run checkpoint history`.
4. Wait for `Run complete`.
5. Confirm the current thread facts and current state are visible.
6. Confirm multiple checkpoint history entries are visible.
7. Select an earlier checkpoint from the history list.
8. Review the selected checkpoint detail, state diff, and raw stream events.

## Expected UI States

- Status changes through the run lifecycle and reaches `Run complete`.
- The visible thread facts include a stable thread id for the completed run.
- Current State displays the latest graph state for the default prompt/topic.
- Checkpoint History shows more than one checkpoint after the run.
- Selecting an earlier checkpoint populates Selected Checkpoint with checkpoint metadata and state details.
- State Diff identifies differences between the selected checkpoint and current state with `changed`, `current`, and `selected` indicators.
- Raw Stream Events is visible and contains streamed run events.

## Backend Assertions

- `checkpoint_state_history` streams successfully through the SDK client.
- The graph creates multiple checkpoints for a single thread.
- The SDK can fetch the current thread state after the run completes.
- The SDK can list checkpoint history for the completed thread.
- Selected checkpoint state differs from current state for at least one field.

## Cleanup

- The browser flow may leave an in-memory thread in the dev server.
- No persistent external data is created.
