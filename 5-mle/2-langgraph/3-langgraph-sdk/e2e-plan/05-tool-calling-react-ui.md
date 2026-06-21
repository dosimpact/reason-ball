# 05 Tool Calling / ReAct UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `tool_calling_react` graph.

## User Actions

1. Open the app and select `05 Tool Calling / ReAct UI`.
2. Confirm the default API URL and calculator prompt are present.
3. Submit the default prompt: `Use the calculator tool to multiply 12 by 7, then explain the result.`
4. Wait for `Run complete`.

## Expected UI States

- Chat messages render in separate human and assistant bubbles.
- A tool call card is visible with the calculator tool name, arguments, status, and result.
- The tool card reaches a success, done, or complete state.
- The tool result includes `84`.
- The final assistant response references `84`.
- Raw Stream Events is visible and records streamed run events.
- Raw Stream Events includes both `messages` and `updates` events.

## Backend Assertions

- `tool_calling_react` streams successfully through the SDK client.
- The assistant emits a tool call for the calculator path.
- The graph returns the tool result before the final assistant message.

## Cleanup

- The browser flow may leave an in-memory thread in the dev server.
- No persistent external data is created.
