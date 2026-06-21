# 16 Long-term Memory UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `long_term_memory` graph.
- Example navigation includes `16 Long-term Memory UI`.
- The UI provides a default API URL, user id input, memory key or id input, memory content textarea, and buttons named like `Create memory`, `Update memory`, `Delete memory`, `Recall memories`, and `Recall in new thread`.
- If supported by the UI, an optional `Recall other user` flow demonstrates user namespace isolation.
- The SDK client streams with `updates` and `custom` modes so state updates and memory-operation events are visible.

## User Actions

1. Open the app and select `16 Long-term Memory UI`.
2. Confirm the default API URL, memory editor fields, and memory action buttons are present.
3. Enter a unique E2E user id, memory key, and memory content string.
4. Click `Create memory` and confirm the memory appears in `Durable Memories`.
5. Click `Recall in new thread` for the same user and confirm `Cross-thread Proof` shows the same durable memory outside the original thread.
6. If `Recall other user` exists, run it and confirm the test memory is not shown for that other user.
7. Update the memory content with the same user id and key, then click `Update memory`.
8. Confirm `Durable Memories` shows the updated content and does not rely on thread-local state alone.
9. Click `Delete memory` and confirm the durable store no longer shows the test memory.
10. Review `Memory Editor`, `Durable Memories`, `Thread State`, `Cross-thread Proof`, `Memory Events`, `Final Answer`, `Final State`, and `Raw Stream Events`.

## Expected UI States

- `Memory Editor` keeps the user id, memory key or id, and content values visible and editable between operations.
- `Durable Memories` shows memory id, user id or namespace, content, and mutation status for create, update, recall, and delete flows.
- `Thread State` shows thread-local fields such as thread label, thread notes, selected action, or current input separately from durable store records.
- `Cross-thread Proof` shows that a memory created in one thread can be recalled in a new thread for the same user id.
- Optional other-user recall shows isolation by returning no test memory for a different user id.
- `Memory Events` displays custom stream events for create, recall, update, and delete operations.
- `Final Answer` is populated after each completed operation and describes the current durable memory snapshot without relying on exact model wording.
- `Final State` contains fields such as `user_id`, `namespace`, `thread_notes`, `memories`, `memory_operations`, `memory_events`, `assistant_response`, and `final`.
- `Raw Stream Events` contains both `updates` and `custom` stream events, including memory-operation events and final state updates.

## Backend Assertions

- The SDK client streams against graph id `long_term_memory`.
- Stream mode includes both `updates` and `custom`.
- Memory store operations use namespace `["memories", "long-term-memory-ui", userId]`.
- Create writes the requested memory key and content into the store.
- Same-user recall in a new thread returns the durable memory even though thread-local state is different.
- Update overwrites the durable memory value for the same key.
- Delete removes the durable memory value for the same key.
- Other-user recall, when exposed, does not return memories from the test user namespace.
- Final graph state includes `memories`, `memory_operations`, `memory_events`, `thread_notes`, `namespace`, final answer text, and trace data.
- Raw stream event output includes enough `updates` and `custom` chunks to inspect create, recall, update, delete, and finalization transitions.

## Subagent Tracking Notes

- Implementation-tracking subagents should keep example 16 marked in progress until the React route, `long_term_memory` graph registration, and this E2E spec pass together.
- The E2E subagent should update `progress/e2e-progress.md` after the broader workflow allows progress-file edits.
- Mark the E2E status complete only after a Playwright MCP run verifies durable store persistence across threads, user isolation, update/delete behavior, thread-local state separation, final state fields, and raw stream events against the real OpenAI-backed graph.

## Cleanup

- The browser flow deletes the created memory through the UI before completing.
- The automated spec should also use SDK cleanup when available:
  `client.store.deleteItem(["memories", "long-term-memory-ui", userId], key)`.
- Test isolation should use a unique user id, memory key, original content, and updated content for every run.
- Page storage should be cleared before the test if the UI stores selected users, memory form values, expanded panels, or stream results locally.
