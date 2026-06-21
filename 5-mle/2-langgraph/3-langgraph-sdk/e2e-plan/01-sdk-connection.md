# 01 SDK Connection E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.

## User Actions

1. Open the SDK Connection example.
2. Click `Load assistants`.
3. Confirm `sdk_connection` is available.
4. Submit the default prompt with `Run and stream`.

## Expected UI States

- Status changes from `Idle` to assistant load status, then `Run complete`.
- Thread and run identifiers are displayed.
- The response panel contains an OpenAI-backed graph response.
- Stream events include metadata and updates rows.

## Backend Assertions

- Assistant search succeeds against the LangGraph API.
- A thread is created for the run.
- `sdk_connection` invokes the OpenAI-backed graph and streams at least one update.

## Cleanup

- The test may leave an in-memory thread if the UI run is used.
- SDK smoke scripts should delete threads when they create them outside the UI.
