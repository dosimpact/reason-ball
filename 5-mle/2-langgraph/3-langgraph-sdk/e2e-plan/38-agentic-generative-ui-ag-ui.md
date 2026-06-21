# 38 Agentic Generative UI AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full generated workspace execution requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify example 38 appears as implemented in navigation.
- Verify the generated workspace preview panel renders.
- Verify suggestions include `Generate workspace` and `Create launch plan`.

## Main Flow

1. Select example 38.
2. Assert the heading is `Agentic Generative UI AG-UI`.
3. Assert the generated workspace side panel text is visible.
4. Assert Copilot chat controls and suggestions are visible.

## Backend Assertions

- Live execution should target graph id `agentic_generative_ui`.
- The renderer should handle `build_task_workspace` loading and complete payloads.

## Cleanup

- Surface-only checks do not create persistent data.
