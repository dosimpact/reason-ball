# 2026-10-06 — UI-PUSH-COLLAPSE-25

Context: user requested opening/closing the work history as a dropdown.

Change: wrap each Assistant progress list in native details/summary labeled 작업 과정, initially collapsed. Preserve disclosure DOM across streamed updates and keep the final answer outside it. Add compact disclosure styling and keyboard focus visibility.

Stock: business/system UI-PUSH-CHAT-25, example plan, and E2E acceptance synchronized.

Validation: TypeScript lint; no automated tests or browser/provider execution.
