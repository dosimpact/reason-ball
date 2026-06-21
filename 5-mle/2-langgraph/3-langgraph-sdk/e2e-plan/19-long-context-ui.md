# 19 Long Context UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `long_context` graph.
- Example navigation includes `19 Long Context UI`.
- The UI provides a default API URL, `Follow-up message` textarea, and buttons named `New context thread`, `Seed long conversation`, `Send message`, `Reload state`, and `Reset`.
- The SDK client streams with `updates` and `custom` modes.

## User Actions

1. Open the app and select `19 Long Context UI`.
2. Confirm the default API URL, controls, and panels are present: `Context Budget`, `Summary of Earlier Context`, `Recent Messages`, `Summarized Messages`, `Compaction Events`, `Assistant Answer`, `Final State`, and `Raw Stream Events`.
3. Click `New context thread`.
4. Click `Seed long conversation` and wait for compaction to complete.
5. Confirm the summary, summary metadata, summary records, summarized messages, compaction events, and recent retained messages are visible.
6. Send a follow-up asking for facts from the summarized earlier context.
7. Confirm the follow-up runs on the same thread and the assistant answer uses facts preserved in the summary.
8. Review `Final State` and `Raw Stream Events`.

## Expected UI States

- `Context Budget` shows the compaction threshold or budget, summarized or removed message count, and recent retained message count.
- `Summary of Earlier Context` contains a non-empty summary of older seeded turns.
- `Recent Messages` contains only the retained recent turns after compaction, not the full seeded conversation.
- `Summarized Messages` lists or summarizes messages removed from the active recent context.
- `Compaction Events` displays custom compaction lifecycle events.
- `Assistant Answer` is populated after the follow-up and refers to facts from the earlier summarized context.
- `Final State` contains `summary`, `summary_metadata`, `summary_records`, `summarized_messages`, `context_events`, and recent message state.
- `Raw Stream Events` contains both `updates` and `custom` stream events, including compaction or context event payloads.

## Backend Assertions

- Stream requests target graph id `long_context`.
- Stream mode includes both `updates` and `custom`.
- Seed run triggers context compaction and emits custom context events.
- Final graph state includes `summary`, `summary_metadata`, `summary_records`, `summarized_messages`, `context_events`, and only recent retained messages.
- Follow-up sends on the same thread as the seeded long conversation.
- Follow-up answer can use facts preserved in the summary even when those facts are no longer in the active recent message list.

## Cleanup

- Each test starts with `New context thread` and unique follow-up text.
- Page storage should be cleared before selecting the example so prior thread ids, form values, stream logs, and summary state do not affect the run.
- Tests do not create durable store records and require no backend cleanup beyond thread isolation.
