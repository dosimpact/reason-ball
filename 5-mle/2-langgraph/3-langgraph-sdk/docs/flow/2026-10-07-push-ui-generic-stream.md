# UI-PUSH-STREAM-25: generic tuple message processing

- Context: the frontend depended on assistant_message_id updates and a hardcoded final node, preventing ordinary message-ID streams from displaying.
- Change: parse ID/text from tuples; prefer explicit application metadata.message_id and fall back to chunk.id. Upsert absent Assistant messages, accumulate running ones, reject late chunks for finished messages. Remove activeAssistantId and node-name filtering.
- Linking: final LLM invocation supplies metadata.message_id matching its placeholder and saved response. Internal calls already suppress streaming with langsmith:nostream. This optional metadata key is our contract, not an SDK requirement.
- Failure: fail all running Assistant messages rather than one graph-specific ID. Check optional final_status when present.
- Stock: docs/stock/system-design.md UI-PUSH-CHAT-25 and UI-PUSH-LAYERS-25; plan/25-push-ui-message.md. Product behavior remains one bubble with collapsible progress.
- Validation: `pnpm --filter langgraph-sdk-examples lint` passed (tsc --noEmit); browser E2E not rerun for this change. Previous E2E evidence describes the prior implementation.
