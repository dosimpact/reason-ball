# 2026-10-06 — UI-PUSH-STATE-25

Context: user requested removing unnecessary graph state, suggesting error as an example. Current source contains user-added Korean comments; preserve those while simplifying state.

Change: remove answer/final (duplicate Assistant content), ui_render_status (diagnostic duplicate), and workflow_id (derive UI IDs from the already unique assistant_message_id). Keep messages, ui, assistant_message_id, stage_results, final_status, and error.

Rationale: frontend actually reads error to display failure details and final_status to recognize completion; graph routing also reads final_status. stage_results supplies context for later LLM calls. Retain these functional fields rather than relocate them into message metadata. No frontend changes are necessary because it does not depend on the removed fields.

Stock: docs/stock/system-design.md UI-PUSH-CHAT-25; synchronized example plan and E2E contract. Previous flow records remain historical.

Validation: graph import/compilation and state schema inspection; diff review. No tests or provider calls. Live browser validation remains unverified.
