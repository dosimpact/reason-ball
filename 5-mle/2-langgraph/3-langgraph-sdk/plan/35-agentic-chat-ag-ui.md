# 35 Agentic Chat AG-UI

## Coding Scope

- Graph: `graphs/35_agentic_chat_ag_ui.ts` implements the LangChain `createAgent` example with CopilotKit AG-UI middleware and exports the inner graph.
- Frontend: `src/examples/35-agentic-chat-ag-ui/` renders a CopilotKit chat surface with frontend tools, render tools, user context, and suggestions.
- Runtime: add a standalone CopilotKit runtime service and Vite proxy for `/api/copilotkit` so the Vite app can connect to the LangGraph agent.

## Implementation Plan

1. Install required packages with pnpm: `@copilotkit/react-core`, `@copilotkit/sdk-js`, `zod`, and the LangChain/LangGraph JS packages needed by the TypeScript graph.
2. Add an `agentic_chat` graph using `createAgent`, model `openai:gpt-4o`, no backend tools initially, `copilotkitMiddleware`, and system prompt `You are a helpful assistant.`
3. Export `agenticChatAgent.graph`, not the wrapper, so managed checkpointer injection works for thread resume and second-turn state access.
4. Add a React example that wraps `CopilotChat` in `CopilotKit`, passes `agent="agentic_chat"`, and points `runtimeUrl` at `/api/copilotkit`.
5. Register frontend behavior from the Dojo example: `useAgentContext` for user name `Bob`, `change_background` via `useFrontendTool`, `get_weather` via `useRenderTool`, and always-available suggestions for background changes and sonnet generation.
6. Register the example in the app shell, metadata list, LangGraph config, runtime service, and Vite proxy after the graph/runtime wiring is in place.

## SDK And State Notes

Keep CopilotKit-specific state local to this example. The background tool should update only the example container state, and the weather renderer should normalize tool results that arrive either as parsed objects or JSON-encoded strings. The graph entry should use the AG-UI middleware path for frontend tool injection instead of duplicating frontend tools as backend tools.

## Risks

- CopilotKit v2 package versions and peer dependencies may drift; install through pnpm and verify the lockfile resolves cleanly.
- The current app is Vite-based, so the CopilotKit runtime route may require a separate dev-server adapter or documented proxy rather than a Next.js route.
- Exporting the agent wrapper instead of `.graph` can break managed persistence on follow-up turns.
- CSS from `@copilotkit/react-core/v2/styles.css` can conflict with the existing shell if the example is not scoped carefully.

## Acceptance Criteria

- The Agentic Chat AG-UI example appears as example 35 in the navigation.
- The Copilot chat renders and can complete a normal assistant response.
- Asking for a background change triggers the frontend tool and visibly updates `data-testid="background-container"`.
- Asking for weather renders a completed `data-testid="weather-info"` card with normalized fields.
- Suggested prompts are visible and usable.
- A second message in the same thread works without a missing checkpointer or resume error.
