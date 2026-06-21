# 39 Tool Based Generative UI AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full haiku card generation requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify example 39 appears as implemented in navigation.
- Verify Copilot chat renders.
- Verify suggestions include `Haiku card` and `Bright poem card`.

## Main Flow

1. Select example 39.
2. Assert the heading is `Tool Based Generative UI AG-UI`.
3. Assert Copilot chat controls are visible.
4. Assert both haiku suggestions are visible.

## Backend Assertions

- Live execution should target graph id `tool_based_generative_ui`.
- The renderer should handle `generate_haiku_card` payloads and fallback states.

## Cleanup

- Surface-only checks do not create persistent data.
