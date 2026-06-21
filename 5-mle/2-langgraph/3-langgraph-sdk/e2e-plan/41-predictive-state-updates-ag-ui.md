# 41 Predictive State Updates AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full backend confirmation requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify predictive document panel renders.
- Verify local predictive controls `Predict shorten`, `Confirm`, and `Reset` are visible.
- Verify suggestions include `Shorten document` and `Explain revision`.

## Main Flow

1. Select example 41.
2. Assert `data-testid="predictive-document-panel"` is visible.
3. Click `Predict shorten`.
4. Assert prediction status changes from `none` to a pending state.
5. Click `Confirm` and assert confirmed state is visible.

## Backend Assertions

- Live execution should target graph id `predictive_state_updates`.
- Frontend reconciliation should use `apply_document_update`.

## Cleanup

- UI state is component-local and resettable.
