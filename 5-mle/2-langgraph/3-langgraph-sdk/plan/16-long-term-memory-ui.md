# 16 Long-term Memory UI

## Coding Scope

- Graph: `graphs/16_long_term_memory.py` adapts `15_long_term_memory`.
- Frontend: `src/examples/16-long-term-memory-ui/` distinguishes thread state from cross-thread memory.

## Implementation Plan

1. Build graph support for user-scoped memory read/write operations.
2. Add memory list, create, edit, and delete UI.
3. Show thread messages beside durable memories.
4. Demonstrate memory reuse across a new thread for the same user id.

## SDK And State Notes

State should include thread-scoped messages, memory operations, user id, and current store snapshot.

## Risks

- User id scoping mistakes can leak memories between examples or test users.
- Store cleanup is required for repeatable tests.

## Acceptance Criteria

- A memory created in one thread is visible in another thread.
- Users can edit and delete memories.
- Thread-local and long-term data are visually separate.
