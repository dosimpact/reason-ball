# UI-PUSH-UTILS-25: extract stream utilities

- Context: record guards and text conversion obscured the stream interpretation flow.
- Change: move JsonRecord, isRecord and textContent unchanged into local utils.ts. Update helper consumers to import directly from utils.ts, keeping stream.ts focused on node updates and tuple interpretation. Preserve current message reducer/state logic.
- Stock: docs/stock/system-design.md UI-PUSH-LAYERS-25; plan/25-push-ui-message.md.
- Validation: `pnpm --filter langgraph-sdk-examples lint` passed (tsc --noEmit); no tests/browser E2E run.
