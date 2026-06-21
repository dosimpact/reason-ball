# 02 Basic Chat UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.

## User Actions

1. Open the app and select `02 Basic Chat UI`.
2. Send `My project code is cobalt.`
3. Wait for `Run complete`.
4. Send `What project code did I give you? Answer with just the code.`
5. Reload the active thread state.

## Expected UI States

- A thread id appears after the first message.
- The same conversation remains selected for the second message.
- Both human messages and both assistant responses are visible in the message list.
- The final assistant response includes `cobalt`.

## Backend Assertions

- `basic_chat` assistant streams successfully.
- Both runs use the same LangGraph thread id.
- Thread state contains the accumulated message history.

## Cleanup

- The browser flow may leave an in-memory thread in the dev server.
- No persistent external data is created.
