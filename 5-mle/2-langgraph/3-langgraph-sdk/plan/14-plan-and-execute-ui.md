# 14 Plan-and-Execute UI

## Coding Scope

- Graph: `graphs/14_plan_and_execute.py` adapts `13_plan_and_execute`.
- Frontend: `src/examples/14-plan-and-execute-ui/` separates plan generation from step execution.

## Implementation Plan

1. Build a planner node that creates a small ordered step list.
2. Build executor nodes that update step status.
3. Render planned, active, completed, failed, and replanned states.
4. Add controls for stop and replan if supported by graph state.

## SDK And State Notes

Keep plan steps as structured objects with id, title, status, result, and error. Stream updates per step.

## Risks

- Plans can change during execution; the UI must handle inserted, removed, or rewritten steps.
- Stop/replan controls need clear disabled states while a run is active.

## Acceptance Criteria

- Users can see the plan before all execution is complete.
- Active and completed steps are visually distinct.
- Replanning or stop behavior is reflected in graph state.
