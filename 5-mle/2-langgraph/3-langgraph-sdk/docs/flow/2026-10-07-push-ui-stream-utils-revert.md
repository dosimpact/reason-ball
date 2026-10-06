# Revert UI-PUSH-UTILS-25

- Context: user requested undoing the utility extraction.
- Change: restored JsonRecord/isRecord/textContent and original imports to stream.ts; removed utils.ts. Other message/state changes remain as found.
- Supersedes: docs/flow/2026-10-07-push-ui-stream-utils.md.
- Stock: system-design.md and plan/25-push-ui-message.md restored to the prior module layout.
- Validation: pnpm --filter langgraph-sdk-examples lint passed; no tests run.
