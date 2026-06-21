# 36 Backend Tool Rendering AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- The example is selectable from the left navigation.
- Full chat/tool execution additionally requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify example 36 appears as implemented in navigation.
- Verify the CopilotKit chat surface renders.
- Verify suggestions include `Search inventory` and `Warehouse status`.
- Verify the plan path points to `plan/36-backend-tool-rendering-ag-ui.md`.

## Main Flow

1. Select example 36.
2. Assert the workspace heading is `Backend Tool Rendering AG-UI`.
3. Assert the Copilot chat input and send button are visible.
4. Assert both inventory suggestions are visible.

## Backend Assertions

- Live backend execution should target graph id `backend_tool_rendering`.
- The backend tool renderer should render `search_inventory` loading and completed states.

## Cleanup

- Surface-only checks do not create persistent data.
