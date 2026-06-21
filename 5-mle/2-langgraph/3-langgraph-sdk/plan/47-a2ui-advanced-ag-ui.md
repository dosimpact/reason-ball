# 47 A2UI Advanced AG-UI

## Coding Scope

- Graph: `graphs/47_a2ui_advanced_ag_ui.py` implements dynamic A2UI with progress events and frontend action handlers.
- Frontend: `src/examples/47-a2ui-advanced-ag-ui/` renders dynamic UI, custom progress, and action callbacks.
- Runtime: reuse the shared CopilotKit runtime, AG-UI renderer, and frontend action registration patterns.

## Implementation Plan

1. Add an `a2ui_advanced` graph that emits dynamic schema updates plus explicit progress events.
2. Support frontend actions such as selecting an option, applying a filter, or confirming a generated result.
3. Render a custom progress component for backend phases like planning, fetching, composing, and waiting for action.
4. Wire frontend action handlers back into the agent flow without replacing the backend as source of truth.
5. Show action results in both the generated UI panel and the chat transcript.
6. Register graph, runtime agent, example metadata, and route as example 47.

## SDK And State Notes

The backend owns generated UI schema and progress state. Frontend action handlers send user intent back to the graph/runtime and should not mutate authoritative A2UI state without backend confirmation.

## Risks

- Combining dynamic schema, progress streaming, and action handlers creates ordering issues.
- Action handler names and payloads must stay stable for resumable flows.
- Renderer validation is required because malformed dynamic UI could otherwise break the whole example.

## Acceptance Criteria

- The A2UI Advanced AG-UI example appears as example 47 in the navigation.
- The UI shows custom progress while dynamic A2UI is generated.
- At least one frontend action handler sends a user selection back to the agent.
- The generated UI updates after the action is handled.
- Malformed schema or action errors render visibly without crashing the app.
