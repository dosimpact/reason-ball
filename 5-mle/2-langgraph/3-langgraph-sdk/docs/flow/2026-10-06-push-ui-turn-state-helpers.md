# 2026-10-06 — UI-PUSH-SETTERS-25

User requested grouping related setter calls into functions without restructuring unrelated updates. Extracted startTurn, completeTurn, and failTurn inside usePushUiChat; resetChat was already grouped. Kept useState, thread assignment, and individual stream updates. Setter order and completion/error behavior are preserved. System stock synchronized. TypeScript lint checked; no tests or provider/browser calls.
