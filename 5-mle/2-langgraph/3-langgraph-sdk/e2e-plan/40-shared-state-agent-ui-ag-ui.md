# 40 Shared State Between Agent and UI AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full agent collaboration requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify shared recipe panel renders with editable title, servings, ingredients, and notes.
- Verify `Add protein` updates visible shared state.
- Verify `Reset` restores starter recipe state.
- Verify suggestions include `Read recipe` and `Make it spicy`.

## Main Flow

1. Select example 40.
2. Assert `data-testid="shared-recipe-panel"` is visible.
3. Click `Add protein` and assert `roasted tofu` appears.
4. Click `Reset` and assert the activity log records reset.

## Backend Assertions

- Live execution should target graph id `shared_state_agent_ui`.
- Frontend tools should expose `apply_recipe_patch` and `read_recipe_state`.

## Cleanup

- UI state is component-local and resettable.
