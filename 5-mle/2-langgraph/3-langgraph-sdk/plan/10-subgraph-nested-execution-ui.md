# 10 Subgraph Nested Execution UI

## Coding Scope

- Graph: `graphs/10_subgraph_nested_execution.py` adapts `04_subgraph`, `11_2_supervisor`, and `11_4_supervisor_chat_subgraph`.
- Frontend: `src/examples/10-subgraph-nested-execution-ui/` renders parent and child execution.

## Implementation Plan

1. Build a parent graph with one or more named subgraphs.
2. Stream parent updates and nested subgraph updates with path metadata.
3. Render a collapsible tree and breadcrumb like `supervisor > team > worker`.
4. Separate parent messages/state from subgraph messages/state.

## SDK And State Notes

Prefer event metadata paths over string parsing. Keep a raw event viewer for nested stream payloads.

## Risks

- Nested stream metadata can be runtime-version dependent.
- Deep trees can overwhelm the page without collapsible defaults.

## Acceptance Criteria

- Parent graph and subgraph execution are visually distinct.
- Users can expand subgraph details on demand.
- Breadcrumbs identify the active nested node path.
