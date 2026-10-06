# 2026-10-06 — UI-PUSH-TYPES-25

Context: user requested explicit frontend types for the thinking_status payload.

Change: define a Zod schema and inferred ThinkingStatusProps, Partial update type, typed metadata, and a ThinkingStatusMessage type guard. Validate full initial payloads and partial merge events. Render typed props directly and use total in the progress label. Existing unknown/incomplete-message JSON fallback remains available.

Rationale: check actual stream data as well as providing compile-time field types; support backend merge=True patches without requiring full props in every event.

Stock: docs/stock/system-design.md UI-PUSH-TYPES-25; example plan synchronized.

Validation: TypeScript lint. No new dependencies, tests, or provider calls.
