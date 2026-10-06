# UI-PUSH-STREAM-25: simplify Assistant delta parsing

- Context: stream-sample.log has 136 messages tuples with string content; inline type guards and nested content handling made assistantDelta difficult to read.
- Change: validate tuple fields with an existing Zod dependency, extract text in textContent, and keep only filtering/ID selection in assistantDelta. Retain text-block support, empty-text skipping and langsmith:nostream filtering. No backend or ID contract changes.
- Stock: docs/stock/system-design.md UI-PUSH-CHAT-25; plan/25-push-ui-message.md.
- Validation: `pnpm --filter langgraph-sdk-examples lint` passed (tsc --noEmit); tests/browser E2E not run for this change.
