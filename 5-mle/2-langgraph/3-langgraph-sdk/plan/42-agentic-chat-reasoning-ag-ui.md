# 42 Agentic Chat Reasoning AG-UI

## Coding Scope

- Graph: `graphs/42_agentic_chat_reasoning_ag_ui.py` implements a Python chat agent that exposes safe reasoning summaries and frontend/backend tools.
- Frontend: `src/examples/42-agentic-chat-reasoning-ag-ui/` renders CopilotKit chat with collapsible reasoning/status blocks.
- Runtime: reuse the shared CopilotKit runtime.

## Implementation Plan

1. Add an `agentic_chat_reasoning` graph using the shared model factory and a prompt that emits concise public reasoning summaries or status notes.
2. Include at least one frontend or backend tool so the example remains comparable to Agentic Chat.
3. Stream reasoning/status summaries as explicit public metadata or custom messages, not hidden chain-of-thought.
4. Add a React chat example with a collapsible reasoning block attached to assistant responses.
5. Clearly separate reasoning summary, tool activity, and final answer in the UI.
6. Register graph, runtime agent, example metadata, and route as example 42.

## SDK And State Notes

Only provider-approved reasoning summaries or graph-authored status messages may be shown. The implementation must not request, store, or display hidden chain-of-thought.

## Risks

- Some models may not provide reasoning summary fields, so graph-authored status messages may be needed for deterministic UI behavior.
- Reasoning content can be confused with final answer text if not rendered separately.
- Tool streaming and reasoning streaming can interleave.

## Acceptance Criteria

- The Agentic Chat Reasoning AG-UI example appears as example 42 in the navigation.
- A representative prompt shows a collapsible public reasoning/status block.
- The final answer remains separate from the reasoning summary.
- Tool activity still renders when a tool is invoked.
- No hidden chain-of-thought text is requested or displayed.
