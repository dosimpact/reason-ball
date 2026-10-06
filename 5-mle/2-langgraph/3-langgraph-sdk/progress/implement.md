# Implementation Progress

Source: `goal.md` and `plan/*.md`

Status key:
- `pending`: not started.
- `in_progress`: actively being implemented.
- `implemented`: code complete; live validation may be pending.
- `blocked`: cannot proceed without a dependency or decision.
- `verified`: implemented and checked with local tests.

## Current Phase

Planning and boilerplate are complete. Examples 01-34 are implemented and verified end to end, including live 29-34 artifact verification against `http://dodonet.iptime.org:2805`. Examples 35-47 have AG-UI implementations and passed live CopilotKit E2E against `http://dodonet.iptime.org:2805`. Example 48 is implemented and verified locally with a deterministic `TodoListMiddleware` graph and browser smoke test. Example 49 is implemented as a deterministic loop engineering harness.

## Boilerplate Tracker

| Area | Status | Notes |
| --- | --- | --- |
| Workspace package setup | verified | Added `package.json`, `tsconfig.json`, Vite config, and pnpm scripts. |
| Graph runtime setup | verified | Added `pyproject.toml`, `langgraph.json`, `common/`, and `graphs/01_sdk_connection.py`. |
| Shared SDK client | verified | Added `src/lib/langgraphClient.ts` with assistant/thread/run helpers and stream parsing. |
| Shared UI shell | verified | Added example navigation, run status, response panel, and event log. |
| Test tooling | verified | Added pytest smoke, Playwright config, and E2E spec for example 01. |

## Example Tracker

| No. | Example | Plan | Implementation status | Graph entrypoint | Frontend route/component | Blockers | Verification notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | SDK Connection | `plan/01-sdk-connection.md` | verified | `01_sdk_connection` | `/examples/01-sdk-connection` | None | `pnpm test`, `pnpm build`, `uv run pytest`, OpenAI smoke, SDK stream smoke, and Playwright E2E passed. |
| 02 | Basic Chat UI | `plan/02-basic-chat-ui.md` | verified | `02_basic_chat` | `/examples/02-basic-chat-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK multi-turn OpenAI smoke, and Playwright E2E passed. |
| 03 | Graph Execution Timeline | `plan/03-graph-execution-timeline.md` | verified | `03_graph_execution_timeline` | `/examples/03-graph-execution-timeline` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK timeline OpenAI smoke, screenshot review, and Playwright E2E passed. |
| 04 | Streaming UI | `plan/04-streaming-ui.md` | verified | `04_streaming_ui` | `/examples/04-streaming-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI smoke across `messages`, `updates`, `values`, and `custom`, and full 01-04 Playwright E2E passed. |
| 05 | Tool Calling ReAct UI | `plan/05-tool-calling-react-ui.md` | verified | `05_tool_calling_react` | `/examples/05-tool-calling-react-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI tool-call smoke, screenshot review, and full 01-05 Playwright E2E passed. |
| 06 | Human-in-the-loop Interrupt UI | `plan/06-human-in-the-loop-interrupt-ui.md` | verified | `06_human_in_the_loop_interrupt` | `/examples/06-human-in-the-loop-interrupt-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI interrupt/resume smoke for edited approval and rejection, screenshot review, focused 06 Playwright E2E, and full 01-06 Playwright E2E passed. |
| 07 | Checkpoint State History UI | `plan/07-checkpoint-state-history-ui.md` | verified | `07_checkpoint_state_history` | `/examples/07-checkpoint-state-history-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI checkpoint/history smoke, screenshot review, focused 07 Playwright E2E, and full 01-07 Playwright E2E passed. |
| 08 | Time Travel Replay UI | `plan/08-time-travel-replay-ui.md` | verified | `08_time_travel_replay` | `/examples/08-time-travel-replay-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI checkpoint replay smoke, screenshot review, focused 08 Playwright E2E, and full 01-08 Playwright E2E passed. |
| 09 | Conditional Routing UI | `plan/09-conditional-routing-ui.md` | verified | `09_conditional_routing` | `/examples/09-conditional-routing-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI conditional-routing smoke for summary/translation/support, screenshot review, focused 09 Playwright E2E, and full 01-09 Playwright E2E passed. |
| 10 | Subgraph Nested Execution UI | `plan/10-subgraph-nested-execution-ui.md` | verified | `10_subgraph_nested_execution` | `/examples/10-subgraph-nested-execution-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI nested subgraph smoke for analytics/writing teams with `streamSubgraphs`, screenshot review, focused 10 Playwright E2E, and full 01-10 Playwright E2E passed. |
| 11 | Parallel Map-Reduce UI | `plan/11-parallel-map-reduce-ui.md` | verified | `11_parallel_map_reduce` | `/examples/11-parallel-map-reduce-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI map-reduce smoke with `updates` and `custom` worker events, screenshot review, focused 11 Playwright E2E, and full 01-11 Playwright E2E passed. |
| 12 | Structured Output UI | `plan/12-structured-output-ui.md` | verified | `12_structured_output` | `/examples/12-structured-output-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI structured-output smoke, screenshot review, focused 12 Playwright E2E, and full 01-12 Playwright E2E passed. |
| 13 | RAG QA UI | `plan/13-rag-qa-ui.md` | verified | `13_rag_qa` | `/examples/13-rag-qa-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI RAG/citation smoke, screenshot review, focused 13 Playwright E2E, and full 01-13 Playwright E2E passed. |
| 14 | Plan-and-Execute UI | `plan/14-plan-and-execute-ui.md` | verified | `14_plan_and_execute` | `/examples/14-plan-and-execute-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI normal/replan smoke with custom executor events, screenshot review, focused 14 Playwright E2E, and full 01-14 Playwright E2E passed. |
| 15 | Reflection Evaluator Loop UI | `plan/15-reflection-evaluator-loop-ui.md` | verified | `15_reflection_evaluator_loop` | `/examples/15-reflection-evaluator-loop-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI forced-retry smoke, screenshot review, focused 15 Playwright E2E, and full 01-15 Playwright E2E passed. |
| 16 | Long-term Memory UI | `plan/16-long-term-memory-ui.md` | verified | `16_long_term_memory` | `/examples/16-long-term-memory-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI create/recall/update/delete smoke, screenshot review, focused 16 Playwright E2E, and full 01-16 Playwright E2E passed with `--workers=3`. |
| 17 | Configurable Assistant UI | `plan/17-configurable-assistant-ui.md` | verified | `17_configurable_assistant` | `/examples/17-configurable-assistant-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI default/override config smoke, screenshot review, focused 17 Playwright E2E, and full 01-17 Playwright E2E passed with `--workers=3`. |
| 18 | Retry Error Degradation UI | `plan/18-retry-error-degradation-ui.md` | verified | `18_retry_error_degradation` | `/examples/18-retry-error-degradation-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI flaky/fallback/final-failure smoke, screenshot review, focused 18 Playwright E2E, and full 01-18 Playwright E2E passed with `--workers=3`. |
| 19 | Long Context UI | `plan/19-long-context-ui.md` | verified | `19_long_context` | `/examples/19-long-context-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI seed/follow-up compaction smoke, screenshot review, focused 19 Playwright E2E, and full 01-19 Playwright E2E passed with `--workers=3`. |
| 20 | Observability UI | `plan/20-observability-ui.md` | verified | `20_observability` | `/examples/20-observability-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI observability/timing/token/cost/trace smoke, screenshot review, focused 20 Playwright E2E, and full 01-20 Playwright E2E passed with `--workers=3`. |
| 21 | Intent Feedback Generative UI | `plan/21-intent-feedback-generative-ui.md` | verified | `21_intent_feedback_generative_ui` | `/examples/21-intent-feedback-generative-ui` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI ambiguous/selection smoke, screenshot review, focused 21 Playwright E2E, and full 01-21 Playwright E2E passed with `--workers=3`. |
| 22 | Custom Event Renderer | `plan/22-custom-event-renderer.md` | verified | `22_custom_event_renderer` | `/examples/22-custom-event-renderer` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI custom-event smoke, screenshot review, focused 22 Playwright E2E, and full 01-22 Playwright E2E passed with `--workers=3`. |
| 23 | Thinking Renderer | `plan/23-thinking-renderer.md` | verified | `23_thinking_renderer` | `/examples/23-thinking-renderer` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI public-thinking smoke, screenshot review, focused 23 Playwright E2E, and full 01-23 Playwright E2E passed with `--workers=3`. |
| 24 | Chat Citation Renderer | `plan/24-chat-citation-renderer.md` | verified | `24_chat_citation_renderer` | `/examples/24-chat-citation-renderer` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI citation smoke, screenshot review, focused 24 Playwright E2E, and full 01-24 Playwright E2E passed with `--workers=3`. |
| 25 | push_ui_message Chat | `plan/25-push-ui-message.md` | implemented | `25_push_ui_message_example` | `src/examples/25-push-ui-message/PushUiMessageExample.tsx` | None | UI-PUSH-CHAT-25: lint/build and graph import/structure passed; live provider/browser checks pending. Earlier action-card evidence is superseded; see `docs/flow/2026-10-06-push-ui-chat.md`. |
| 26 | Multimodal Image Input | `plan/26-multimodal-image-input.md` | verified | `26_multimodal_image_input` | `/examples/26-multimodal-image-input` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI vision smoke, screenshot review, focused 26 Playwright E2E, and full 01-26 Playwright E2E passed with `--workers=3`. |
| 27 | Multimodal Voice Input | `plan/27-multimodal-voice-input.md` | verified | `27_multimodal_voice_input` | `/examples/27-multimodal-voice-input` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI audio transcription smoke, screenshot review, focused 27 Playwright E2E, and full 01-27 Playwright E2E passed with `--workers=3`. |
| 28 | Multimodal Voice Output | `plan/28-multimodal-voice-output.md` | verified | `28_multimodal_voice_output` | `/examples/28-multimodal-voice-output` | None | `pnpm test`, `pnpm build`, `uv run pytest`, SDK OpenAI TTS smoke, screenshot review, focused 28 Playwright E2E, and full 01-28 Playwright E2E passed with `--workers=3`. |
| 29 | Chat Code Editor | `plan/29-chat-code-editor.md` | verified | `29_chat_code_editor` | `/examples/29-chat-code-editor` | None | Frontend graph id aligned to registered LangGraph id; `pnpm test`, `pnpm build`, and live 29-34 Playwright E2E passed against `http://dodonet.iptime.org:2805`. |
| 30 | Chat Document Artifact | `plan/30-chat-document-artifact.md` | verified | `30_chat_document_artifact` | `/examples/30-chat-document-artifact` | None | Frontend graph id aligned to registered LangGraph id; editable document canvas with `save_user_edit` and `ai_revise` verified by live 29-34 Playwright E2E against `http://dodonet.iptime.org:2805`. |
| 31 | Chat Plan Board | `plan/31-chat-plan-board.md` | verified | `31_chat_plan_board` | `/examples/31-chat-plan-board` | None | Frontend graph id aligned to registered LangGraph id; direct drag/drop board edits via `move_step` verified by live 29-34 Playwright E2E against `http://dodonet.iptime.org:2805`. |
| 32 | Chat Graph Execution Canvas | `plan/32-chat-graph-execution-canvas.md` | verified | `32_chat_graph_execution_canvas` | `/examples/32-chat-graph-execution-canvas` | None | Frontend graph id aligned to registered LangGraph id; inspect/select-event/time-travel canvas flow verified by live 29-34 Playwright E2E against `http://dodonet.iptime.org:2805`. |
| 33 | Chat UI Preview | `plan/33-chat-ui-preview.md` | verified | `33_chat_ui_preview` | `/examples/33-chat-ui-preview` | None | Frontend graph id aligned to registered LangGraph id; preview/apply/revert artifact flow verified by live 29-34 Playwright E2E against `http://dodonet.iptime.org:2805`. |
| 34 | Chat Data Analysis Canvas | `plan/34-chat-data-analysis-canvas.md` | verified | `34_chat_data_analysis_canvas` | `/examples/34-chat-data-analysis-canvas` | None | Frontend graph id aligned to registered LangGraph id and CSV upload control added; `pnpm test`, `pnpm build`, and live 29-34 Playwright E2E passed against `http://dodonet.iptime.org:2805`. |
| 35 | Agentic Chat AG-UI | `plan/35-agentic-chat-ag-ui.md` | verified | `35_agentic_chat` | `/examples/35-agentic-chat-ag-ui` | Live chat requires the existing Python LangGraph dev server on `2931` plus the `pnpm --filter langgraph-sdk-examples runtime:copilotkit` service. | Added CopilotKit v2 chat UI, frontend background tool, weather render tool, suggestions, Python LangGraph `35_agentic_chat` graph with `CopilotKitMiddleware` and backend `get_weather`, standalone CopilotKit runtime service, Vite proxy, and app registration; live 35-47 CopilotKit E2E passed against `http://dodonet.iptime.org:2805`. |
| 36 | Backend Tool Rendering AG-UI | `plan/36-backend-tool-rendering-ag-ui.md` | verified | `36_backend_tool_rendering` | `/examples/36-backend-tool-rendering-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added Python backend inventory tool, CopilotKit tool renderer, app/runtime registration, and local verification with `pnpm test`, `pnpm build`, `uv run python -m py_compile`, and dummy-key graph import. |
| 37 | Human in the Loop AG-UI | `plan/37-human-in-the-loop-ag-ui.md` | verified | `37_human_in_the_loop_ag_ui` | `/examples/37-human-in-the-loop-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added frontend approval tool with approve/edit/reject UI, Python approval-oriented agent, app/runtime registration, and local compile/build/import verification. |
| 38 | Agentic Generative UI AG-UI | `plan/38-agentic-generative-ui-ag-ui.md` | verified | `38_agentic_generative_ui` | `/examples/38-agentic-generative-ui-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added backend generated workspace tool, React generated workspace renderer, app/runtime registration, and local compile/build/import verification. |
| 39 | Tool Based Generative UI AG-UI | `plan/39-tool-based-generative-ui-ag-ui.md` | verified | `39_tool_based_generative_ui` | `/examples/39-tool-based-generative-ui-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added backend haiku card tool, React custom card renderer, app/runtime registration, and local compile/build/import verification. |
| 40 | Shared State Between Agent and UI AG-UI | `plan/40-shared-state-agent-ui-ag-ui.md` | verified | `40_shared_state_agent_ui` | `/examples/40-shared-state-agent-ui-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added shared recipe state UI, frontend patch/read tools, Python recipe tools, app/runtime registration, and local compile/build/import verification. |
| 41 | Predictive State Updates AG-UI | `plan/41-predictive-state-updates-ag-ui.md` | verified | `41_predictive_state_updates` | `/examples/41-predictive-state-updates-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added predictive document editor, frontend reconciliation tool, Python document edit tools, app/runtime registration, and local compile/build/import verification. |
| 42 | Agentic Chat Reasoning AG-UI | `plan/42-agentic-chat-reasoning-ag-ui.md` | verified | `42_agentic_chat_reasoning` | `/examples/42-agentic-chat-reasoning-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added public reasoning summary renderer, policy fact renderer, Python reasoning tools, app/runtime registration, and local compile/build/import verification. |
| 43 | Agentic Chat Multimodal AG-UI | `plan/43-agentic-chat-multimodal-ag-ui.md` | verified | `43_agentic_chat_multimodal` | `/examples/43-agentic-chat-multimodal-ag-ui` | Live image analysis depends on configured multimodal model and CopilotKit attachment support. | Added image preview/fixture UI, multimodal observation renderers, Python multimodal tools, app/runtime registration, and local compile/build/import verification. |
| 44 | Subgraphs AG-UI | `plan/44-subgraphs-ag-ui.md` | verified | `44_subgraphs_ag_ui` | `/examples/44-subgraphs-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added deterministic subgraph worker tool, parent/worker progress renderer, scoped CSS, app/runtime registration, and local compile/build/import verification. |
| 45 | A2UI Fixed Schema AG-UI | `plan/45-a2ui-fixed-schema-ag-ui.md` | verified | `45_a2ui_fixed_schema` | `/examples/45-a2ui-fixed-schema-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added fixed-schema flight tool, flight card renderer, scoped CSS, app/runtime registration, and local compile/build/import verification. |
| 46 | A2UI Dynamic Schema AG-UI | `plan/46-a2ui-dynamic-schema-ag-ui.md` | verified | `46_a2ui_dynamic_schema` | `/examples/46-a2ui-dynamic-schema-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added dynamic schema tool, allowlisted schema renderer with fallback, scoped CSS, app/runtime registration, and local compile/build/import verification. |
| 47 | A2UI Advanced AG-UI | `plan/47-a2ui-advanced-ag-ui.md` | verified | `47_a2ui_advanced` | `/examples/47-a2ui-advanced-ag-ui` | Live chat requires LangGraph dev server plus CopilotKit runtime. | Added advanced A2UI tool, progress/action renderer, frontend confirmation tool, scoped CSS, app/runtime registration, and local compile/build/import verification. |
| 48 | Todo List Middleware | `plan/48-todo-list-middleware.md` | verified | `48_todo_list_middleware` | `/examples/48-todo-list-middleware` | None | Added deterministic LangChain `TodoListMiddleware` agent graph, registered graph/example route, and React todo board showing `pending`/`in_progress`/`completed` state from stream values; verified with `pnpm test`, `pnpm build`, Python graph invoke/duplicate-call smoke, and Playwright browser smoke on `http://localhost:2934` with LangGraph API `http://localhost:2935`. |
| 49 | Loop Engineering Harness | `plan/49-loop-engineering-harness-ui.md` | verified | `49_loop_engineering_harness` | `/examples/49-loop-engineering-harness-ui` | None | Added deterministic loop engineering graph, registered graph/example route, and React harness UI showing event-driven, agent, verification, and hill-climbing loops with retry attempts, trace events, and improvement suggestions. |


## 2026-10-06 · UI-GH-01 GitHub design system

- Status: complete. Shared shell, semantic palette, controls, active navigation, and SDK response empty state implemented.
- Validation: final scoped `pnpm --filter langgraph-sdk-examples lint`, `pnpm --filter langgraph-sdk-examples build`, and `git diff --check` passed. The lint script performs TypeScript checking. Production build reports a large-chunk warning.
- Desktop/mobile browser review passed for navigation, focus, and representative layouts; see `progress/e2e-progress.md`. Live assistant loading is unavailable because port 2931 refuses connections; CopilotKit runtime info returns 502.

## 2026-10-06 — UI-PUSH-CHAT-25 revision

Example 25 now uses MessagesState chat, three dummy-data internal LLM calls with progress UI, and a final answer call. Updated plan, E2E contract, stock, and flow. Earlier example-25 verification applies to the superseded action-card UI. Current runtime/browser verification and migration of the old E2E spec are pending.

## 2026-10-06 — UI-PUSH-TURN-25

Refined example 25 to one Assistant message per turn: persisted empty placeholder, work-start UI, three public progress summaries, and final answer replacement by ID. Failed turns persist and stop subsequent calls. Empty placeholders are excluded from model context. Stock and example plan/E2E contract synchronized. Current validation: TypeScript lint, production build, and graph import/structure inspection; live provider/browser acceptance remains unverified.

## 2026-10-06 — SDK-GRAPH-COMMENTS

- 완료: `graphs/` 전체 50개 Python 소스에 큰 흐름을 설명하는 한국어 주석 403줄 추가.
- 검증: 편집 직전 소스 대비 모든 실행 토큰 및 AST 동일, 50개 소스 문법 컴파일 통과. 기존 사용자 변경은 보존.
- 문서: system stock과 `docs/flow/2026-10-06-korean-graph-comments.md` 동기화. 주석 변경이므로 외부 API 및 브라우저 실행 검증은 수행하지 않음.

## 2026-10-06 — UI-PUSH-STATE-25 cleanup

Removed redundant answer/final/ui_render_status/workflow_id from example 25. error and final_status remain functional frontend inputs. Derived UI IDs use the Assistant ID. Updated stock, plan, E2E contract, and flow. Graph import/compilation and schema inspection passed; no automated tests or provider/browser execution.

## 2026-10-06 — UI-PUSH-EDGES-25

Example 25 now declares each node and connection explicitly, with a shared route_after_stage function and named destinations. Removed registration/edge loops and tuple indices. Graph import/compilation confirmed; no runtime/provider tests.

## 2026-10-06 — UI-PUSH-ID-25

Assistant IDs are generated only in prepare_prompt on every turn. Removed old-state fallback, collision check, and frontend Assistant ID input/draft. Frontend uses the preparation update for the response bubble. TypeScript and graph compilation checks; live provider/browser checks remain pending.

## 2026-10-06 — UI-PUSH-TYPES-25

Added typed progress props, partial update contract, metadata fields, runtime schema validation, and renderer type narrowing in example 25. TypeScript lint passed. Live provider/browser checks remain pending.

## 2026-10-06 — UI-PUSH-LIST-25

Example 25 progress now uses compact ul/li items instead of cards. TypeScript lint checked; live browser/provider validation remains pending.

## 2026-10-06 — UI-PUSH-COLLAPSE-25

Progress lists are now collapsed by default under 작업 과정, independently toggleable per Assistant turn. Final answers stay visible. TypeScript lint checked; browser/provider verification remains pending.

## 2026-10-06 — UI-PUSH-MESSAGE-TYPES-25

Paired thinking_status name and props in exported full/partial message types and applied full messages to React state through validated merging. Unsupported payloads have a separate fallback variant. TypeScript lint passed.

## 2026-10-06 — UI-PUSH-READABILITY-25

- 완료: 사용자 요청대로 TSX 파일 하나를 유지하면서 타입/데이터 처리, 메시지 표시, 채팅 실행 순서로 정리. 압축된 상태 변경과 JSX 조건을 풀고 로컬 함수로 의도를 명시.
- 검증: scoped lint와 build 통과. 변경 전후 정규화·UI 병합·메시지 교체 및 6가지 채팅 상태의 서버 렌더링 HTML을 비교하는 21개 점검 통과. 기존 큰 번들 경고는 유지. 실제 provider/browser 재검증은 수행하지 않음.
- 문서: system stock의 UI-PUSH-READABILITY-25와 flow 기록 동기화.

## 2026-10-06 — UI-PUSH-READABILITY-25 minimal split

- 완료: 최신 사용자 요청에 따라 기존 단일 파일 구성을 화면 TSX + `usePushUiChat.ts` 두 파일로 변경. 데이터 타입과 정규화/병합은 hook 파일에 함께 두고, 작은 표시 함수는 화면 파일에 유지함.
- 검증: scoped lint/build 통과. 분리 직전 소스와 비교한 데이터 처리 및 6가지 상태의 동일한 HTML 렌더링 등 21개 점검 통과. 기존 큰 번들 경고 유지. 실제 provider/browser 재검증은 수행하지 않음.
- stock 동기화: UI-PUSH-READABILITY-25를 현재 두 파일 구성으로 갱신. flow: `docs/flow/2026-10-06-push-ui-minimal-split.md`.

## 2026-10-06 — UI-PUSH-SCROLL-25

Removed automatic scrolling and its effect/ref from example 25 at user request. System stock and flow synchronized. TypeScript lint checked.

## 2026-10-06 — UI-PUSH-STATUS-25

Removed duplicate busy state in usePushUiChat. busy derives from status, which stays running through stream consumption and final state lookup. TypeScript lint checked.

## 2026-10-06 — UI-PUSH-SETTERS-25

Grouped turn start/completion/failure setters into local helper functions while keeping independent stream/thread updates and useState. TypeScript lint checked.

## 2026-10-06 — UI-PUSH-STATE-HOOK-25

Separated usePushUiChatState from request/stream orchestration. State and transitions live together; existing view/type exports preserved. TypeScript lint passed.

## 2026-10-06 — UI-PUSH-MERGE-25

- 완료: `mergeUi`에서 name별 스키마 검증/타입 구성을 분리. 공통 병합 결과에 `resolveUi`를 적용하고, `uiDefinitions` 등록으로 UI별 props 검증과 타입을 확장함. 구현 파일 추가 없음.
- 검증: scoped lint/build 및 21개 점검 통과. 기존 진행 UI 회귀, 테스트용 두 번째 이름 등록, 부분 갱신, 잘못된 payload, fallback, 동일 ID의 이름 변경, 삭제, 두 번째 이름 추가 시 전체 TypeScript 타입 검사 확인. 실제 provider/browser 검증은 수행하지 않음.
- stock: UI-PUSH-MERGE-25 반영. flow: `docs/flow/2026-10-06-push-ui-merge-resolution.md`.

## 2026-10-06 — UI-PUSH-TUPLE-25

Refactored example 25 to request messages-tuple/updates/custom. Final-node text deltas update the existing Assistant turn; internal-stage tokens are excluded. Final saved state confirms the answer, and failed streams retain partial text locally with an interrupted label. Scoped lint and build passed; Vite emitted a chunk-size warning. Live provider/browser validation and old E2E migration remain pending. See docs/flow/2026-10-06-push-ui-messages-tuple.md.

## 2026-10-06 — UI-PUSH-LAYERS-25

- 분리: screen, bubble, diagnostics, request hook, state hook, chat transformations, UI contracts/merging, stream parsing. Existing useState, named UI registration and one-Assistant-per-turn behavior retained.
- Cleanup: form event handling stays in view, protocol parsing stays outside state hook, snapshot reconciliation updates messages once, and turnStatus is a string union.
- Validation: scoped TypeScript lint/build and diff whitespace check passed. Vite emitted a large-chunk warning. No automated tests or live provider/browser checks were run.
- Stock: system-design UI-PUSH-READABILITY-25/UI-PUSH-LAYERS-25 and UI-PUSH-MERGE-25 synchronized. Flow: docs/flow/2026-10-06-push-ui-layers.md.

## 2026-10-06 — UI-PUSH-E2E-25

Example 25 live success and browser-isolated fault/protocol E2E passed: 4 Chromium tests at localhost:2805. Migrated the obsolete spec, preserving all progressive-answer and saved-state assertions. No production logic changes were required during validation. Report/evidence: docs/flow/2026-10-06-push-ui-e2e.md; playwright-report/index.html.

## 2026-10-06 — EXAMPLES-LAYERS-06

In progress: independent layer refactor across the 53 folders other than example 25. Ownership: 01–12/variants, 13–24, 26–34+48–49, root 35–47. Plan: plan/examples-layer-refactor.md. Existing shared edits retained.

## 2026-10-06 — EXAMPLES-LAYERS-06 complete

All53 remaining example folders refactored with independent local modules; example25 retained. Parallel groups completed17/12/11/13 folders. Individual bilingual plans and consolidated stock/module inventory synchronized. Final scoped lint/build and whitespace check passed; all54-folder audit found0 sibling dependencies/runtime cycles/React imports in pure data modules. Vite large-chunk warning remains. No tests or all-example live E2E run for this task. Evidence: docs/flow/2026-10-06-examples-layer-refactor.md and docs/flow/2026-10-06-examples-layer-audit.json.

## 2026-10-07 UI-PUSH-STREAM-25

Generic tuple ID/text accumulation and optional progress-message linkage implemented. Static type check passed (pnpm --filter langgraph-sdk-examples lint); browser E2E not rerun. See docs/flow/2026-10-07-push-ui-generic-stream.md.

## 2026-10-07 stream parser simplification

Separated tuple validation, text extraction and Assistant delta handling. See docs/flow/2026-10-07-push-ui-stream-simplification.md.

## 2026-10-07 UI-PUSH-SSOT-25

Server messages retain all received fields without frontend patches. Pending input/drafts are separate; display data is extracted by selectMessageViews. Type check passed; browser E2E not rerun. See docs/flow/2026-10-07-push-ui-message-ssot.md.

## 2026-10-07 UI-PUSH-UTILS-25

Extracted record/text helpers to local utils.ts and updated imports. See docs/flow/2026-10-07-push-ui-stream-utils.md.

## 2026-10-07 UI-PUSH-UTILS-25 reverted

User requested undo. Restored stream utilities/imports and removed utils.ts. See docs/flow/2026-10-07-push-ui-stream-utils-revert.md.

## 2026-10-07 — UI-PUSH-SSOT-25 unified display state

- 완료: messages/drafts/pendingUser/messageViews 분리를 messages: ChatMessage[] 하나로 통합. chatMessagesReducer에서 start/delta/server/fail/reset을 처리하고 화면은 messages를 직접 표시함. 원본 서버 응답은 기존 진단 값에서 확인 가능.
- 검증: 24개 reducer 회귀 점검, scoped lint/build, 기존 Chromium E2E 3개(초기 상태, 정상 스트림 fixture, 중단 부분 답변 fixture) 통과. 포트 59251의 작업 소유 Vite에서 실행. 실제 provider 테스트는 이번 변경에서 재실행하지 않음. 기존 큰 번들 경고 유지.
- 문서: system stock, 25번 plan/E2E contract 동기화. flow: docs/flow/2026-10-07-push-ui-message-ssot.md.

## 2026-10-07 EXAMPLES-REMEDA-07 in progress

All example utility refactor delegated by disjoint folder groups; root handles25 and dependency/integration. See plan/examples-remeda-refactor.md.

## 2026-10-07 EXAMPLES-REMEDA-07 complete

54/54folders covered,94files importRemeda; no sibling imports/custom isRecord wrappers. Scoped lint/typecheck/build passed. Domain reducers/native browser logic preserved; no tests/E2E rerun. See docs/flow/2026-10-07-examples-remeda.md.
