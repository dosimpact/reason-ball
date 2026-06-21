# 46 A2UI Dynamic Schema AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full dynamic schema rendering requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify dynamic schema side panel renders.
- Verify allowed renderer types and fallback language are visible.
- Verify suggestions include `Comparison UI`, `Intake form`, and `Checklist`.

## Main Flow

1. Select example 46.
2. Assert the heading is `A2UI Dynamic Schema AG-UI`.
3. Assert dynamic schema explanatory text is visible.
4. Assert all dynamic schema suggestions are visible.

## Backend Assertions

- Live execution should target graph id `a2ui_dynamic_schema`.
- Renderer should whitelist form, list, comparison, and summary nodes.

## Cleanup

- Surface-only checks do not create persistent data.
