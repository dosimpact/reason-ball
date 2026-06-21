# 03 Graph Execution Timeline

## Coding Scope

- Graph: `graphs/03_graph_execution_timeline.py` adapts `01_simple_graph` and streaming behavior from `07_streaming`.
- Frontend: `src/examples/03-graph-execution-timeline/` renders node status cards and state panels.

## Implementation Plan

1. Define a small multi-node graph with deterministic node names and visible state updates.
2. Stream `updates` and map each update to `pending`, `running`, `done`, `error`, or `skipped`.
3. Render a horizontal or vertical timeline with current node emphasis.
4. Show final state beside per-node updates for comparison.

## SDK And State Notes

The UI should consume stream events rather than inferring progress from final output. Keep a normalized event store keyed by node name.

## Risks

- Stream events can arrive quickly or out of expected visual order; the event reducer must be idempotent.
- Skipped nodes may need explicit graph metadata if the runtime does not emit them.

## Acceptance Criteria

- During execution, the active node changes in real time.
- Completed nodes retain their update payloads.
- Final state is shown separately from incremental node updates.
