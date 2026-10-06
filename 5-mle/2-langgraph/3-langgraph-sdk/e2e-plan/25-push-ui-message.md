# 25 push_ui_message chat E2E plan — UI-PUSH-CHAT-25

## Setup

Run the committed frontend dev script on port 2805 and graph dev script on port 2931. Use an owned test server and configured provider credentials. Graph ID is `25_push_ui_message_example`. This contract supersedes the former action-card demo assertions.

## Scenarios

1. Select example 25; confirm Chat, Messages, Message composer, Send, and New chat. Diagnostics start collapsed.
2. Send a unique user prompt. Inspect the request: input contains a user message with an ID; modes are updates and custom.
3. Observe `데이터 검색중`, `자료 취합중`, `자료 완성중` in order, each transitioning running to completed before the next stage. Verify work-start UI plus three stage UI IDs, short public progress summaries, and no additional internal chat messages. Record the initial Assistant bubble ID and confirm it remains unchanged throughout the run.
4. Confirm the final assistant answer appears after the third UI and all UI metadata points at its message ID.
5. Send a follow-up referencing the previous user prompt. Confirm the same thread, four public messages (two Human and two AI), eight UI messages (work-start plus three stages per turn), and distinct Assistant IDs and derived UI IDs for both turns.
6. Expand diagnostics; confirm state has messages, ui, assistant_message_id, stage_results, final_status=completed, and error="". Final text lives in the Assistant message; no answer/final/ui_render_status/workflow_id fields are written by this graph.
7. Exercise a provider failure in an isolated environment; confirm failed status and a retained empty Assistant bubble, no subsequent model calls, and no completed final answer. Send another turn and confirm the failed bubble persists; its empty content must not enter model input.
8. New chat clears local history; the next send creates a different thread. Restore owned test configuration and release only owned processes.

## Evidence status

Updated contract; live browser/provider verification is pending. The existing `e2e/25-push-ui-message.spec.ts` targets the previous action-card UI and needs migration before running this new contract.

## Work history disclosure

Confirm 작업 과정 starts collapsed. Toggle it by click and keyboard, observe the progress list, and verify the open state survives streamed updates and final answer arrival. Closing it hides only the work history, not the final answer. Each turn toggles independently.
