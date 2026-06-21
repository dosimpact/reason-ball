# 38 Agentic Generative UI AG-UI

## Coding Scope

- Graph: `graphs/38_agentic_generative_ui_ag_ui.py` implements a Python agent that performs a long-running task and emits structured UI/progress state.
- Frontend: `src/examples/38-agentic-generative-ui-ag-ui/` renders a generated task workspace with progress, partial outputs, and final artifact.
- Runtime: reuse the shared CopilotKit runtime and AG-UI wiring.

## Implementation Plan

1. Add an `agentic_generative_ui` graph that decomposes a user request into steps and streams progress updates while producing an artifact.
2. Model the artifact as structured data such as task title, checklist, generated sections, status, and final summary.
3. Emit UI-oriented state updates from the backend so React can render the evolving task surface without parsing prose.
4. Add a React example that pairs `CopilotChat` with a generated UI panel for the current task.
5. Render step progress, currently active step, partial artifact content, completion state, and error state.
6. Register the graph, runtime agent, example metadata, and app route as example 38.

## SDK And State Notes

The backend owns task progress and artifact content. The frontend renders state snapshots and streamed updates, with local state only for transient UI selection such as expanded sections.

## Risks

- Long-running examples need deterministic progress for tests and should not depend on slow external tools.
- Streaming payloads must remain compact enough for the chat UI.
- Generated UI state should be versioned or typed enough to avoid renderer crashes when fields are missing.

## Acceptance Criteria

- The Agentic Generative UI AG-UI example appears as example 38 in the navigation.
- Submitting a long-running task shows progress before the final answer.
- The generated UI panel updates as steps complete.
- The final artifact remains visible after the chat response completes.
- Errors render in the task panel rather than only in raw logs.
