# 2026-10-06 — UI-PUSH-SCROLL-25

User requested removing the auxiliary automatic scroll behavior. Removed the message-list ref, useEffect, and React hook imports from PushUiMessageExample.tsx. Message/progress updates no longer force scrolling. System stock synchronized. TypeScript lint checked; no browser or provider tests.
