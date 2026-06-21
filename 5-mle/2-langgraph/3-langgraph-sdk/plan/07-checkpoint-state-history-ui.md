# 07 Checkpoint State History UI

## Coding Scope

- Graph: `graphs/07_checkpoint_state_history.py` adapts `06_checkpointer`.
- Frontend: `src/examples/07-checkpoint-state-history-ui/` displays current state and checkpoint history.

## Implementation Plan

1. Build a checkpointed graph with multiple visible state mutations.
2. Add state fetch helpers and checkpoint listing helpers.
3. Render current state, checkpoint list, selected checkpoint detail, and a state diff.
4. Link each checkpoint to the run and node update that produced it when available.

## SDK And State Notes

Use LangGraph thread state and history APIs. Normalize checkpoint ids and timestamps for UI display.

## Risks

- Checkpoint ordering may differ from display expectations; sort by runtime timestamp when available.
- Large state payloads need compact rendering to keep the UI usable.

## Acceptance Criteria

- After a run, multiple checkpoints are visible.
- Selecting a checkpoint shows the state at that moment.
- The UI can compare selected checkpoint state with current state.
