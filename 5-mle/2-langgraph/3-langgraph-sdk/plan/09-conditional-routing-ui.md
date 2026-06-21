# 09 Conditional Routing UI

## Coding Scope

- Graph: `graphs/09_conditional_routing.py` adapts `04_subgraph` and `11_1_supervisor`.
- Frontend: `src/examples/09-conditional-routing-ui/` visualizes branch decisions.

## Implementation Plan

1. Create a graph with at least two named conditional branches.
2. Emit or expose routing decision metadata in state updates.
3. Render branch cards with selected and skipped status.
4. Provide sample inputs that trigger different routes.

## SDK And State Notes

Stream `updates` so branch selection appears before final output. Store selected branch, reason, and skipped branch names.

## Risks

- Branch decisions may be implicit in graph edges unless the graph writes explicit route metadata.
- LLM-based routing can be flaky; use deterministic routing inputs for tests.

## Acceptance Criteria

- Different inputs select different branches.
- Selected branch is emphasized and skipped branches remain visible.
- The routing reason is visible in a structured panel.
