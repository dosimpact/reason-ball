# 03 Graph Execution Timeline E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.

## User Actions

1. Open the app and select `03 Graph Execution Timeline`.
2. Keep the default topic or enter `streaming graph updates`.
3. Click `Run timeline`.
4. Wait for `Run complete`.

## Expected UI States

- `prepare_topic`, `call_model`, and `finalize` node cards become `done`.
- Each node card retains its update payload.
- Final State displays `topic`, `prompt`, `draft`, `final`, `steps`, and `node_updates`.
- Raw stream events include update events.

## Backend Assertions

- `graph_execution_timeline` assistant streams successfully.
- The `call_model` node invokes OpenAI.
- The final state contains all three node names in `steps`.

## Cleanup

- The browser flow may leave an in-memory thread in the dev server.
- No persistent external data is created.
