# 46 A2UI Dynamic Schema AG-UI

## Coding Scope

- Graph: `graphs/46_a2ui_dynamic_schema_ag_ui.py` implements a Python graph that generates dynamic A2UI surfaces from conversation context.
- Frontend: `src/examples/46-a2ui-dynamic-schema-ag-ui/` renders schema-driven UI components with streaming updates.
- Runtime: reuse the shared CopilotKit runtime and AG-UI renderer plumbing.

## Implementation Plan

1. Add an `a2ui_dynamic_schema` graph that decides which UI schema to emit based on the user's request.
2. Support a small approved component set such as form, list, comparison cards, and summary panel.
3. Stream schema/data updates so the frontend can render partial UI while the agent continues.
4. Add a React schema renderer that validates component type and required props before rendering.
5. Render unsupported schema nodes as a safe fallback with a clear warning.
6. Register graph, runtime agent, example metadata, and route as example 46.

## SDK And State Notes

Dynamic schema does not mean arbitrary React execution. The frontend renders only whitelisted component types and sanitized props emitted by the backend.

## Risks

- Overly flexible schemas can create unsafe or untestable render paths.
- Streaming schema updates may arrive before all required data is present.
- Model output must be constrained enough for deterministic E2E tests.

## Acceptance Criteria

- The A2UI Dynamic Schema AG-UI example appears as example 46 in the navigation.
- Different prompt types produce different whitelisted UI surfaces.
- Streaming updates visibly refine the generated UI.
- Unsupported or malformed schema nodes render a fallback.
- The final assistant response references the generated UI state.
