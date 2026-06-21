# 02 Basic Chat UI

## Coding Scope

- Graph: `graphs/02_basic_chat.py` adapts sibling examples `02_llm_graph` and `06_checkpointer` into a checkpointed chat graph.
- Frontend: `src/examples/02-basic-chat-ui/` implements a multi-turn chat route.
- Shared code: message normalization utilities for Human, AI, Tool, and system-like metadata.

## Implementation Plan

1. Build a chat graph that accepts `messages` and persists state by `thread_id`.
2. Register the graph and expose a stable assistant id for the example.
3. Add a conversation sidebar with new thread, previous thread selection, and delete.
4. Stream assistant output into the message list while preserving final thread state.

## SDK And State Notes

Use thread-scoped runs. Store thread metadata locally enough to switch conversations, but treat LangGraph state as authoritative.

## Risks

- LLM responses are nondeterministic, so tests should assert continuity and UI state rather than exact wording.
- Thread id handling must be stable or history reuse will appear broken.

## Acceptance Criteria

- Sending a second message on the same thread includes prior context.
- Switching to an older thread restores visible history.
- Loading and send states are distinct from assistant message content.
