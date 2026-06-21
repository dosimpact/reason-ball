# 35 Agentic Chat AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- A CopilotKit runtime endpoint is reachable through `VITE_COPILOTKIT_RUNTIME_URL` or `/api/copilotkit`.
- The runtime is connected to the `agentic_chat` LangGraph graph served by `langgraph.agentic-chat.json`.
- The example is selectable from the left navigation.

## Surface Checks

- Verify the example 35 nav item appears as implemented.
- Verify the CopilotKit chat surface renders inside `data-testid="background-container"`.
- Verify suggestion chips include background change and sonnet prompts.
- Verify the chat panel remains framed inside the existing app shell on desktop and mobile widths.

## Main Flow

1. Select example 35.
2. Send a normal chat message and assert an assistant response is rendered.
3. Send `Change the background to a teal and violet gradient.`
4. Assert the frontend tool completes and the background container style changes.
5. Ask for weather in Seoul.
6. Assert the weather renderer shows `data-testid="weather-info"` with city, temperature, humidity, wind speed, and conditions fields.
7. Send a second follow-up message on the same conversation.
8. Assert the follow-up succeeds without a missing checkpointer or resume error.

## Backend Assertions

- Runtime requests target agent id `agentic_chat`.
- Frontend tools are injected through CopilotKit AG-UI middleware, not duplicated as backend tools.
- The graph export used by LangGraph is `agenticChatAgent.graph`.
- Tool result payloads may arrive as JSON strings and must still render correctly.

## Cleanup

- No persistent files or external artifacts are created.
- In-memory runtime threads may remain after the test run.
