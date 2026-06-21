# 08 Time Travel Replay UI

## Coding Scope

- Graph: `graphs/08_time_travel_replay.py` extends the checkpoint graph from example 07.
- Frontend: `src/examples/08-time-travel-replay-ui/` supports replay and fork workflows.

## Implementation Plan

1. Reuse checkpoint history primitives from example 07.
2. Add controls to select a checkpoint and start a replay from that state.
3. Support forked input or config overrides for comparison.
4. Render original run and fork run side by side.

## SDK And State Notes

Use the SDK APIs for state history and checkpoint-based run configuration. Preserve original thread/run references.

## Risks

- Replay semantics are easy to confuse with normal rerun; label original, replay, and fork clearly.
- Forked runs must not overwrite the original thread state without explicit intent.

## Acceptance Criteria

- A user can choose a previous checkpoint and start another run from it.
- Fork output is distinguishable from original output.
- The UI shows which checkpoint produced each replay.
