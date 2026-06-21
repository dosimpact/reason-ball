# 32 Chat Graph Execution Canvas

## Coding Scope

- Graph: `graphs/32_chat_graph_execution_canvas.py` combines streaming, subgraphs, checkpoints, and time travel.
- Frontend: `src/examples/32-chat-graph-execution-canvas/` provides chat plus debugger canvas.

## Implementation Plan

1. Reuse timeline, nested execution, checkpoint, and replay primitives.
2. Render chat, node graph, state diff, checkpoint list, and stream log in coordinated panels.
3. Link each chat message to relevant graph events when possible.
4. Support selecting a run event to inspect state at that point.

## SDK And State Notes

Normalize events once in shared code so multiple panels read the same event store.

## Risks

- Combining many debugger panels can create inconsistent selected state.
- Large event logs need filtering and virtualization if they grow.

## Acceptance Criteria

- One run can be inspected from chat, graph, state, and event perspectives.
- Selecting events updates detail panels.
- Checkpoints and time travel remain available in the combined view.
