# 2026-10-06 — UI-PUSH-TURN-25

## Context and decision

User approved visualizing work start, processing stages, and the final response inside one Assistant message. This refines UI-PUSH-CHAT-25; it does not expose raw private reasoning or add internal model prompts to public chat.

## Implementation

The frontend immediately creates an empty Assistant turn and sends its ID. Preparation persists that ID through MessagesState and emits work-start UI. Each stage attaches running/completed/failed progress and a short public summary. The final response replaces the same message ID. Empty placeholders are filtered from all LLM context. Reused or omitted IDs cannot replace previous turns.

Failed stages and final model calls persist failed UI/status, retain the placeholder, and finish the graph without later calls. Frontend normalization preserves empty turns, so failures remain visible on later messages. One renderer handles both empty and completed turns; progress updates auto-scroll the list.

## Stock and acceptance

Updated docs/stock/business-design.md and system-design.md (UI-PUSH-CHAT-25), plan/25-push-ui-message.md, e2e-plan/25-push-ui-message.md, and progress records. Acceptance requires one Assistant ID/bubble through the entire turn and no internal calls in public message history.

## Validation

TypeScript lint and production build passed. Python graph import and compiled Mermaid inspection passed, including failure routes to END. No live provider calls, automated tests, or real browser checks were performed. Prior action-card E2E spec remains incompatible with the current acceptance contract.
