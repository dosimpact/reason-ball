# LangGraph SDK examples: business design

Current state: 2026-10-06.

## UI-PUSH-CHAT-25: progress in chat

Example 25 is a multi-turn chat. Each user prompt triggers three internal LLM calls on dummy material, with `데이터 검색중`, `자료 취합중`, and `자료 완성중` UI, followed by a fourth LLM call for the final answer. The conversation and prior progress stay visible. New chat resets the local view. Each turn has one Assistant bubble from work start through completion: work-start status, three short public progress summaries, and the final answer. Stage summaries describe work/results and are rendered as a compact list inside the Assistant turn. The progress list is collapsed by default under a “작업 과정” disclosure; users can open or close it independently for each turn. The final answer remains outside that disclosure. Each item shows an icon, stage title, status, and inline summary, without separate cards. They are not additional chat messages. Failed turns remain visible with an interrupted status. Diagnostics are collapsed by default. See `plan/25-push-ui-message.md` and `docs/flow/2026-10-06-push-ui-chat.md`.
