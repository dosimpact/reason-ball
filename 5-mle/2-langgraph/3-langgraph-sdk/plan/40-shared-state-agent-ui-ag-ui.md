# 40 Shared State Between Agent and UI AG-UI

## Coding Scope

- Graph: `graphs/40_shared_state_agent_ui_ag_ui.py` implements a Python agent that reads and updates shared recipe state.
- Frontend: `src/examples/40-shared-state-agent-ui-ag-ui/` renders editable recipe state alongside CopilotKit chat.
- Runtime: reuse the shared AG-UI runtime and thread-backed state flow.

## Implementation Plan

1. Add a `shared_state_agent_ui` graph with state fields for recipe title, servings, ingredients, instructions, and notes.
2. Let the agent read current recipe state and propose structured updates through backend logic.
3. Add React controls for direct UI edits to servings, ingredients, and notes.
4. Synchronize UI edits and agent updates through the same shared state shape so both sides collaborate on one recipe.
5. Render recent state changes as a small activity list to clarify whether a change came from user controls or the agent.
6. Register graph, runtime agent, example metadata, and route as example 40.

## SDK And State Notes

The shared recipe object is the source of truth for this example. React can stage text edits locally, but committed edits should update the shared state consumed by the agent on the next turn.

## Risks

- Conflicts can occur if the user edits while an agent run is streaming updates.
- State patch semantics must be clear enough to avoid overwriting unrelated recipe fields.
- CopilotKit shared state APIs may require adapter-specific wiring in the Vite runtime.

## Acceptance Criteria

- The Shared State Between Agent and UI AG-UI example appears as example 40 in the navigation.
- UI controls can update recipe state without sending a chat message.
- The agent can read the updated recipe state and reference it in a response.
- The agent can modify recipe state and the React panel updates.
- Concurrent or repeated updates do not erase unrelated fields.
