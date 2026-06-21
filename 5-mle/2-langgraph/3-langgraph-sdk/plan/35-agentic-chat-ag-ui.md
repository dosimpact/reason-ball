# 35 Agentic Chat AG-UI

## Coding Scope

- Graph: `graphs/35_agentic_chat_ag_ui.py` implements a Python LangChain/LangGraph agent with CopilotKit AG-UI middleware.
- Frontend: `src/examples/35-agentic-chat-ag-ui/` renders a CopilotKit chat surface with frontend tools, render tools, user context, and suggestions.
- Runtime: add a standalone CopilotKit runtime service and Vite proxy for `/api/copilotkit` so the Vite app can connect to the LangGraph agent.

## Implementation Plan

1. Install required frontend/runtime packages with pnpm: `@copilotkit/react-core`, `@copilotkit/runtime`, and `zod`.
2. Add an `agentic_chat` Python graph using `langchain.agents.create_agent`, `CopilotKitMiddleware`, the shared OpenAI model factory, a backend `get_weather` tool, and system prompt `You are a helpful assistant.`
3. Register the Python graph in the main `langgraph.json` so it runs with the existing `uv run langgraph dev --host 0.0.0.0 --port 2931 --tunnel` process.
4. Add a React example that wraps `CopilotChat` in `CopilotKit`, passes `agent="agentic_chat"`, and points `runtimeUrl` at `/api/copilotkit`.
5. Register frontend behavior from the Dojo example: `useAgentContext` for user name `Bob`, `change_background` via `useFrontendTool`, `get_weather` via `useRenderTool`, and always-available suggestions for background changes and sonnet generation.
6. Register the example in the app shell, metadata list, LangGraph config, runtime service, and Vite proxy after the graph/runtime wiring is in place.

## SDK And State Notes

Keep CopilotKit-specific state local to this example. The background tool should update only the example container state, and the weather renderer should normalize tool results that arrive either as parsed objects or JSON-encoded strings. The Python graph uses CopilotKit middleware for frontend tool injection, while the weather capability belongs in the backend graph so `useRenderTool` can render the backend tool result.

## Risks

- CopilotKit v2 package versions and peer dependencies may drift; install through pnpm and verify the lockfile resolves cleanly.
- The current app is Vite-based, so the CopilotKit runtime route may require a separate dev-server adapter or documented proxy rather than a Next.js route.
- The CopilotKit runtime must point at `LANGGRAPH_URL` for the Python LangGraph server, not at the Vite app or the runtime itself.
- CSS from `@copilotkit/react-core/v2/styles.css` can conflict with the existing shell if the example is not scoped carefully.

## Acceptance Criteria

- The Agentic Chat AG-UI example appears as example 35 in the navigation.
- The Copilot chat renders and can complete a normal assistant response.
- Asking for a background change triggers the frontend tool and visibly updates `data-testid="background-container"`.
- Asking for weather renders a completed `data-testid="weather-info"` card with normalized fields.
- Suggested prompts are visible and usable.
- A second message in the same thread works without a missing checkpointer or resume error.
