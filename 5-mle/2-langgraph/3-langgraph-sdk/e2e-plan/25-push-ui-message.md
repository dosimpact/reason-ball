# 25 push_ui_message chat E2E plan — UI-PUSH-CHAT-25

## Setup

Run the committed frontend dev script on port 2805 and graph dev script on port 2931. Use the user-requested existing app at http://localhost:2805/ and configured provider credentials. Do not restart existing servers. Isolate fault cases with Playwright browser request fixtures, without modifying shared provider credentials. Graph ID is `25_push_ui_message_example`. This contract supersedes the former action-card demo assertions.

## Scenarios

1. Select example 25; confirm Chat, Messages, Message composer, Send, and New chat. Diagnostics start collapsed.
2. Send a unique user prompt. Inspect the request: input contains a user message with an ID; modes are messages-tuple, updates, and custom.
3. Observe `데이터 검색중`, `자료 취합중`, `자료 완성중` in order, each transitioning running to completed before the next stage. Verify work-start UI plus three stage UI IDs, short public progress summaries, and no additional internal chat messages. Record the initial Assistant bubble ID and confirm it remains unchanged throughout the run.
4. Confirm final-node text grows progressively after the third stage in the existing Assistant bubble. No provider-ID bubble or internal-stage text appears. Whitespace and text blocks are preserved. All UI metadata points at the prepared Assistant ID. Compare completed content with the saved response and ensure no duplicated tokens.
5. Send a follow-up referencing the previous user prompt. Confirm the same thread, four public messages (two Human and two AI), eight UI messages (work-start plus three stages per turn), and distinct Assistant IDs and derived UI IDs for both turns.
6. Expand diagnostics; confirm state has messages, ui, assistant_message_id, stage_results, final_status=completed, and error="". Final text lives in the Assistant message; no answer/final/ui_render_status/workflow_id fields are written by this graph.
7. Exercise a simulated provider interruption through a browser-isolated SSE fixture; confirm failed status and a retained Assistant bubble (empty before generation, or retaining received partial text if interrupted during generation), no subsequent model calls, and no completed final answer. Send another turn and confirm the failed bubble persists; its empty content must not enter model input.
8. New chat clears local history; the next send creates a different thread. Restore owned test configuration and release only owned processes.

## Evidence status

The migrated `e2e/25-push-ui-message.spec.ts` covers initial UI, live provider streaming/multiturn/new-chat, and browser-isolated fixtures for text blocks, hidden internal tokens, late deltas, UI patches/removal/fallback, and interrupted partial answers. Execution evidence is recorded in docs/flow/2026-10-06-push-ui-e2e.md.

## Work history disclosure

Confirm 작업 과정 starts collapsed. Toggle it by click and keyboard, observe the progress list, and verify the open state survives streamed updates and final answer arrival. Closing it hides only the work history, not the final answer. Each turn toggles independently.

## Fixture coverage and limits

Live success assertions require multiple growing DOM answer samples before node completion and exact equality with saved thread state. Synthetic fixtures cover interruption, partial-answer retention, text/whitespace blocks, UI merging/removal/fallback and invalid patch rejection; they do not prove actual provider failure recovery. Provider/network state is never modified for fault injection. Real test threads are deleted after the live scenario.

## UI-PUSH-SSOT-25: message update precedence

The same Assistant ID must retain streamed partial text when an empty placeholder arrives, replace it with server final text without duplication, and ignore deltas after completed/failed status. Interrupted partial text remains visible. Optimistic input and early chunks without a placeholder appear in one message list. New chat clears that list. Existing isolated success/interruption fixtures exercise these user-visible rules; pure reducer checks cover event ordering and snapshot reconciliation.
