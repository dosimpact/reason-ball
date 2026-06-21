# 47 A2UI Advanced AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full advanced A2UI execution requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify advanced A2UI side panel renders.
- Verify action state starts with no frontend action confirmed.
- Verify suggestions include `Build decision UI` and `Incident review`.

## Main Flow

1. Select example 47.
2. Assert the heading is `A2UI Advanced AG-UI`.
3. Assert advanced A2UI explanatory text is visible.
4. Assert Copilot chat controls and suggestions are visible.

## Backend Assertions

- Live execution should target graph id `a2ui_advanced`.
- Renderer should handle progress, generated decision panel, and frontend confirmation action.

## Cleanup

- Surface-only checks do not create persistent data.
