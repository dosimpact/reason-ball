# 2026-10-06 — UI-PUSH-MESSAGE-TYPES-25

Context: user requested explicit frontend state types pairing backend name and props.

Change: export ThinkingStatusMessage (literal thinking_status name and full props) and ThinkingStatusUpdateMessage (same name, partial props, merge=true). React UI state uses complete ThinkingStatusMessage or a separate unsupported-message variant. mergeUi validates and constructs typed messages before storing them; incoming raw events remain separate. Renderer narrows on type and accesses typed props.

Stock: system design UI-PUSH-TYPES-25 and example plan synchronized.

Validation: TypeScript lint; no tests or provider/browser calls.
