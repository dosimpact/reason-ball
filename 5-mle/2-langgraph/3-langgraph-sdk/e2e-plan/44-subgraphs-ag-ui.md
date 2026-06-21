# 44 Subgraphs AG-UI E2E Plan

## Preconditions

- Vite serves the examples UI at `http://localhost:2934`.
- Full subgraph execution requires the CopilotKit runtime and Python LangGraph server.

## Surface Checks

- Verify subgraph state panel renders.
- Verify parent/worker/aggregate learning points are visible.
- Verify suggestions include `Coordinate workers` and `Plan incident review`.

## Main Flow

1. Select example 44.
2. Assert the heading is `Subgraphs AG-UI`.
3. Assert subgraph state explanatory text is visible.
4. Assert Copilot chat controls and suggestions are visible.

## Backend Assertions

- Live execution should target graph id `subgraphs_ag_ui`.
- Tool renderer should render `run_subgraph_workers` parent and worker rows.

## Cleanup

- Surface-only checks do not create persistent data.
