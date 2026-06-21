# 37 Human in the Loop AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full approval execution requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify example 37 appears as implemented in navigation.
- Verify the approval console is visible.
- Verify empty approval state is visible before a run.
- Verify suggestions include approval-oriented prompts.

## Main Flow

1. Select example 37.
2. Assert the heading is `Human in the Loop AG-UI`.
3. Assert `data-testid="ag-ui-approval-empty"` is visible.
4. Assert Copilot chat controls and approval suggestions are visible.

## Backend Assertions

- Live execution should target graph id `human_in_the_loop_ag_ui`.
- Frontend approval should be handled through `request_task_approval`.

## Cleanup

- Surface-only checks do not create persistent data.
