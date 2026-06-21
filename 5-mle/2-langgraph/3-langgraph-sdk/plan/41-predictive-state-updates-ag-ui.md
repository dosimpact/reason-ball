# 41 Predictive State Updates AG-UI

## Coding Scope

- Graph: `graphs/41_predictive_state_updates_ag_ui.py` implements a Python agent that edits document state and streams confirmed patches.
- Frontend: `src/examples/41-predictive-state-updates-ag-ui/` renders a document editor with optimistic updates and backend-confirmed state.
- Runtime: reuse the shared CopilotKit runtime and AG-UI state wiring.

## Implementation Plan

1. Add a `predictive_state_updates` graph with document state fields for title, body, revision, and last operation.
2. Support backend edit operations such as rewrite title, improve paragraph, shorten text, and append summary.
3. Add a React document editor that applies user-requested or agent-predicted edits optimistically.
4. Stream confirmed backend state patches and reconcile them with optimistic UI state.
5. Show pending, confirmed, and reverted edit states so users can understand predictive updates.
6. Register graph, runtime agent, example metadata, and route as example 41.

## SDK And State Notes

React may predict the visual result of an edit, but the Python graph remains authoritative. Reconciliation should use a revision number or operation id to avoid applying stale patches.

## Risks

- Optimistic edits can diverge from final model output.
- Patch ordering matters when multiple edits run close together.
- E2E tests need deterministic prompts and seeded document content.

## Acceptance Criteria

- The Predictive State Updates AG-UI example appears as example 41 in the navigation.
- A document edit request updates the UI immediately with a pending marker.
- Backend confirmation replaces or confirms the predicted edit.
- Failed edits revert or show an error without losing the previous document.
- Revision or operation status is visible in the UI.
