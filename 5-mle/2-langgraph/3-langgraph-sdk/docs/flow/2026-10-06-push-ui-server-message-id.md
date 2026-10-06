# 2026-10-06 — UI-PUSH-ID-25

Context: user requested unconditional server generation of assistant_id, instead of retrieving a possibly stale ID from state.

Change: prepare_prompt always assigns assistant-{uuid4().hex}. Remove state fallback and duplicate-ID check. Frontend sends only user messages and renders the server's placeholder update; it no longer creates/sends an Assistant ID. Streamed assistant_message_id identifies the turn for local transport-error handling.

Rationale: one owner for turn creation avoids stale state and removes unnecessary defensive logic. Keep assistant_message_id in state only to pass the freshly generated ID to later nodes.

Stock: docs/stock/system-design.md UI-PUSH-CHAT-25 and plan/25-push-ui-message.md synchronized.

Validation: TypeScript lint and graph import/compilation; no provider/browser tests.
