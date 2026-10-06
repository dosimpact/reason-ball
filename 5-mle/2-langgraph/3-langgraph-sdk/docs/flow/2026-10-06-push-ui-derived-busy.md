# 2026-10-06 — UI-PUSH-STATUS-25

User requested removing setBusy and simplifying activity state. busy now derives from status === "running". Removed the busy state/setter and final cleanup block. applyValues no longer copies backend final_status into frontend lifecycle status, preventing controls from enabling before the stream and getState finish. Final successful reconciliation sets completed; catch sets failed. System stock synchronized. TypeScript lint checked; no tests or provider/browser execution.
