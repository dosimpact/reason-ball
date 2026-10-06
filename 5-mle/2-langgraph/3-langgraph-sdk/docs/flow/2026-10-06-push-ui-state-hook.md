# 2026-10-06 — UI-PUSH-STATE-HOOK-25

User requested a separate usePushUiChatState hook for state declarations and grouped state transitions.

Moved useState, derived busy, transition functions, and their payload validation/merge helpers to usePushUiChatState.ts. appendEvent/applyCustomEvent encapsulate state updates required by stream handling. usePushUiChat.ts retains SDK/client/thread/request orchestration and re-exports existing public types. The view API is preserved; no circular imports.

Stock: system design UI-PUSH-READABILITY-25 and example plan synchronized.

Validation: TypeScript lint passed. No tests or browser/provider calls.
