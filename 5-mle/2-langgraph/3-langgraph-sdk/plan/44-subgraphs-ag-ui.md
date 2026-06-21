# 44 Subgraphs AG-UI

## Coding Scope

- Graph: `graphs/44_subgraphs_ag_ui.py` implements a Python LangGraph parent graph with worker subgraphs for multi-agent task execution.
- Frontend: `src/examples/44-subgraphs-ag-ui/` renders CopilotKit chat plus subgraph execution progress.
- Runtime: reuse the shared CopilotKit runtime and LangGraph server.

## Implementation Plan

1. Add a `subgraphs_ag_ui` parent graph that routes a task to at least two named worker subgraphs.
2. Stream or expose subgraph progress with worker name, task, status, partial result, and final result.
3. Add a React example that renders a multi-agent progress panel beside the chat.
4. Show parent graph state separately from worker/subgraph state.
5. Include a prompt that reliably exercises multiple workers and aggregates their outputs.
6. Register graph, runtime agent, example metadata, and route as example 44.

## SDK And State Notes

Subgraph execution state should use stable worker ids so the frontend can update the correct row as streamed events arrive. The final assistant message should summarize aggregated worker results.

## Risks

- Nested LangGraph stream events can be difficult to associate with the correct subgraph without explicit metadata.
- Multi-agent examples can become slow if each worker performs real model calls.
- The UI must avoid confusing skipped, pending, and completed worker states.

## Acceptance Criteria

- The Subgraphs AG-UI example appears as example 44 in the navigation.
- A representative task runs through multiple worker/subgraph steps.
- The frontend shows each worker's status and result.
- The parent aggregation result is visible in the final answer.
- Failed worker state is rendered without breaking the whole progress panel.
