# 39 Tool Based Generative UI AG-UI

## Coding Scope

- Graph: `graphs/39_tool_based_generative_ui_ag_ui.py` implements a Python agent with a tool that returns a UI payload for a haiku-style generator.
- Frontend: `src/examples/39-tool-based-generative-ui-ag-ui/` renders the tool payload as a custom generative UI component.
- Runtime: reuse the CopilotKit runtime and backend tool rendering path.

## Implementation Plan

1. Add a `tool_based_generative_ui` graph using `create_react_agent` and a backend tool such as `generate_haiku_card`.
2. Make the tool return structured UI data: topic, haiku lines, mood, palette, and optional explanation.
3. Register a React `useRenderTool` renderer that maps the backend tool result into a polished haiku card.
4. Provide suggested prompts that reliably call the backend tool.
5. Show raw fallback information only when the structured renderer cannot parse the result.
6. Register graph, runtime agent, example metadata, and route as example 39.

## SDK And State Notes

The UI payload is produced by a backend tool result, not by frontend-only state. The renderer should accept both object and JSON-string tool results to match LangGraph/CopilotKit transport variations.

## Risks

- The model may answer directly instead of calling the tool unless the system prompt strongly routes haiku generation through the tool.
- Tool result rendering can break if optional visual fields are omitted.
- The example overlaps with backend tool rendering, so acceptance should focus on generated UI output rather than generic tool cards.

## Acceptance Criteria

- The Tool Based Generative UI AG-UI example appears as example 39 in the navigation.
- A haiku prompt calls the backend generative UI tool.
- The frontend renders a custom haiku card with all generated lines.
- The assistant can explain or summarize the generated card after the tool result.
- Invalid or incomplete tool payloads show a graceful fallback.
