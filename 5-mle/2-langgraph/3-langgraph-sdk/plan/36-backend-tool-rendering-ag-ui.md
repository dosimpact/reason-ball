# 36 Backend Tool Rendering AG-UI

## Coding Scope

- Graph: `graphs/36_backend_tool_rendering_ag_ui.py` implements a Python LangGraph ReAct agent with backend tools whose execution is rendered in the frontend.
- Frontend: `src/examples/36-backend-tool-rendering-ag-ui/` renders a CopilotKit chat surface and custom backend tool result cards.
- Runtime: reuse the CopilotKit runtime and `/api/copilotkit` Vite proxy introduced for example 35.

## Implementation Plan

1. Add a `backend_tool_rendering` graph using `langgraph.prebuilt.create_react_agent`, `common.llm.create_llm()`, and a deterministic backend tool such as `get_weather` or `search_inventory`.
2. Make the backend tool return structured data with fields needed by the UI: title, status, summary, key metrics, and optional detail rows.
3. Register the graph in `langgraph.json` and the CopilotKit runtime graph list with agent name `backend_tool_rendering`.
4. Add a React example that wraps `CopilotChat` in `CopilotKit`, passes `agent="backend_tool_rendering"`, and registers a `useRenderTool` renderer for the backend tool.
5. Render tool lifecycle states separately from assistant text: pending/loading, completed structured result, empty result, and error.
6. Register the example in the app shell and metadata list as example 36.

## SDK And State Notes

Backend tool execution belongs to the Python graph. The frontend only renders the backend tool call/result payload and should not duplicate the tool as a frontend action. Normalize tool results that arrive as parsed objects or JSON strings.

## Risks

- CopilotKit renderer APIs may differ by package version, especially for backend tool rendering and streamed tool call updates.
- LangGraph tool messages can expose args/results in slightly different shapes depending on stream mode.
- Tool cards must be scoped to this example so CopilotKit CSS does not override existing app layout.

## Acceptance Criteria

- The Backend Tool Rendering AG-UI example appears as example 36 in the navigation.
- Asking for the supported backend tool action invokes the Python tool and renders a custom tool card.
- The UI shows a loading state before the final backend tool result.
- Tool args and final result are visible without requiring users to inspect raw JSON.
- A normal assistant response still renders when no backend tool is needed.
