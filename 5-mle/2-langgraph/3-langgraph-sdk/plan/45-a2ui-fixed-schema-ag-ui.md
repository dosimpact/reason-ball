# 45 A2UI Fixed Schema AG-UI

## Coding Scope

- Graph: `graphs/45_a2ui_fixed_schema_ag_ui.py` implements a Python graph that returns a fixed-schema flight search UI payload.
- Frontend: `src/examples/45-a2ui-fixed-schema-ag-ui/` renders deterministic A2UI flight cards from that schema.
- Runtime: reuse the shared CopilotKit runtime and AG-UI rendering path.

## Implementation Plan

1. Add an `a2ui_fixed_schema` graph that parses a flight-search request into a fixed response shape.
2. Define the fixed UI payload with route, dates, travelers, filters, and a list of flight options.
3. Render the schema with React flight cards, filter chips, price/duration fields, and select buttons.
4. Keep this example non-streaming to demonstrate fixed-schema A2UI behavior.
5. Validate required fields before rendering and show a compact fallback if the payload is incomplete.
6. Register graph, runtime agent, example metadata, and route as example 45.

## SDK And State Notes

The fixed schema is a contract between the Python graph and React renderer. The frontend should not infer missing flight fields from prose.

## Risks

- The model may produce incomplete schema unless the backend constrains or post-processes output.
- Flight data should be fixture-based, not live booking data.
- A2UI renderer failure needs a safe fallback to avoid a blank chat surface.

## Acceptance Criteria

- The A2UI Fixed Schema AG-UI example appears as example 45 in the navigation.
- A flight-search prompt renders structured flight cards.
- The schema does not change between runs except for data values.
- Selecting a flight triggers a visible UI action state.
- Incomplete payloads show a fallback instead of crashing.
