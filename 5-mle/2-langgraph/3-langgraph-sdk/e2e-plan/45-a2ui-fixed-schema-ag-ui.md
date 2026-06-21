# 45 A2UI Fixed Schema AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full fixed-schema flight rendering requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify fixed schema side panel renders.
- Verify suggestions include `Search flights` and `Try another route`.
- Verify Copilot chat controls render.

## Main Flow

1. Select example 45.
2. Assert the heading is `A2UI Fixed Schema AG-UI`.
3. Assert fixed schema explanatory text is visible.
4. Assert flight search suggestions are visible.

## Backend Assertions

- Live execution should target graph id `a2ui_fixed_schema`.
- Renderer should accept only fixed schema version `fixed-flight-search-v1`.

## Cleanup

- Surface-only checks do not create persistent data.
