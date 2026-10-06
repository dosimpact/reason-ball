# 2026-10-06 — UI-PUSH-CHAT-25: chat and staged progress

## Context and accepted change

The user requested MessagesState-based chat and a graph that receives a user prompt, invokes an LLM three times internally with dummy-data progress UI, and returns a final answer. Interpret “Messages Status” as LangGraph `MessagesState`.

The former action/status/unsupported-card demonstration is superseded by three `thinking_status` UI messages: `데이터 검색중`, `자료 취합중`, `자료 완성중`. Each stage contains a real LLM call on dummy material, followed by a fourth call for the final answer. This makes the graph structure explicit while preserving honest demo-data labeling.

Each turn creates fresh workflow/UI/assistant IDs and resets internal preparation state. Public history contains user inputs and final answers. UI metadata references the final assistant ID. Progress starts before each model call and updates in place upon completion or failure. The React view is a multi-turn chat using one thread, with diagnostics collapsed by default. New chat resets only local UI state and starts a fresh thread on next send.

## Affected stock and plans

- `docs/stock/business-design.md`: UI-PUSH-CHAT-25 product behavior.
- `docs/stock/system-design.md`: state, graph, streaming, IDs, and failure behavior.
- `plan/25-push-ui-message.md`: synchronized English and Korean design.
- `e2e-plan/25-push-ui-message.md`: current browser acceptance contract.
- `progress/planning.md`, `progress/implement.md`, `progress/e2e-progress.md`: revision evidence and outstanding validation.

## Validation

- PASS: `pnpm --filter langgraph-sdk-examples lint` (TypeScript).
- PASS: `pnpm --filter langgraph-sdk-examples build` (TypeScript + Vite). Vite reports large bundle chunks.
- PASS: `.venv/bin/python` import of `graphs.25_push_ui_message`; compiled graph Mermaid inspection confirms the three ordered LLM/push-UI nodes before final answer generation.
- Installed `langgraph/graph/ui.py` inspected: push_ui_message emits custom events, writes UI state, and supplies merge/message_id metadata matching the frontend.
- Not run: real provider calls, browser E2E, unit tests. Existing action-card E2E spec is superseded and requires migration to the new acceptance contract before use.

Existing staged and unstaged repository work was present before this change. No Git staging, commits, dependency changes, or service restarts were performed.
