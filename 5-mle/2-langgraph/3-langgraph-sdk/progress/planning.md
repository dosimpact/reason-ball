# Planning Progress

Source: `goal.md`

Status key:
- `pending`: plan file is missing.
- `in_progress`: plan exists but lacks required fields.
- `complete`: plan names coding scope, graph requirements, frontend behavior, SDK/state notes, risks, and acceptance criteria.

## Tracker

| No. | Example | Plan | Status | Owner/agent | Notes/blockers |
| --- | --- | --- | --- | --- | --- |
| 01 | SDK Connection | `plan/01-sdk-connection.md` | complete | main + subagents | MVP; reviewed against basic graph patterns. |
| 02 | Basic Chat UI | `plan/02-basic-chat-ui.md` | complete | main + subagents | MVP; checkpoint/thread continuity focus. |
| 03 | Graph Execution Timeline | `plan/03-graph-execution-timeline.md` | complete | main + subagents | MVP; stream update reducer required. |
| 04 | Streaming UI | `plan/04-streaming-ui.md` | complete | main + subagents | MVP; mode-specific payload parsing. |
| 05 | Tool Calling ReAct UI | `plan/05-tool-calling-react-ui.md` | complete | main + subagents | MVP; tool message normalization. |
| 06 | Human-in-the-loop Interrupt UI | `plan/06-human-in-the-loop-interrupt-ui.md` | complete | main + subagents | MVP; pending run recovery risk. |
| 07 | Checkpoint State History UI | `plan/07-checkpoint-state-history-ui.md` | complete | main + subagents | MVP; state history UI required. |
| 08 | Time Travel Replay UI | `plan/08-time-travel-replay-ui.md` | complete | main + subagents | Core; depends on checkpoint primitives. |
| 09 | Conditional Routing UI | `plan/09-conditional-routing-ui.md` | complete | main + subagents | Core; explicit route metadata needed. |
| 10 | Subgraph Nested Execution UI | `plan/10-subgraph-nested-execution-ui.md` | complete | main + subagents | Core; nested event paths. |
| 11 | Parallel Map-Reduce UI | `plan/11-parallel-map-reduce-ui.md` | complete | main + subagents | Core; worker-id keyed events. |
| 12 | Structured Output UI | `plan/12-structured-output-ui.md` | complete | main + subagents | Core; schema validation required. |
| 13 | RAG QA UI | `plan/13-rag-qa-ui.md` | complete | main + subagents | Core; deterministic fixture corpus. |
| 14 | Plan-and-Execute UI | `plan/14-plan-and-execute-ui.md` | complete | main + subagents | Core; step ids required. |
| 15 | Reflection Evaluator Loop UI | `plan/15-reflection-evaluator-loop-ui.md` | complete | main + subagents | Core; max retry guard. |
| 16 | Long-term Memory UI | `plan/16-long-term-memory-ui.md` | complete | main + subagents | Core; user scope cleanup. |
| 17 | Configurable Assistant UI | `plan/17-configurable-assistant-ui.md` | complete | main + subagents | Core; env alias alignment. |
| 18 | Retry Error Degradation UI | `plan/18-retry-error-degradation-ui.md` | complete | main + subagents | Core; deterministic failures. |
| 19 | Long Context UI | `plan/19-long-context-ui.md` | complete | main + subagents | Core; seed conversation action. |
| 20 | Observability UI | `plan/20-observability-ui.md` | complete | main + subagents | Core; optional usage metadata. |
| 21 | Intent Feedback Generative UI | `plan/21-intent-feedback-generative-ui.md` | complete | main + subagents | Generative UI; whitelisted payloads. |
| 22 | Custom Event Renderer | `plan/22-custom-event-renderer.md` | complete | main + subagents | Renderer; custom event versioning. |
| 23 | Thinking Renderer | `plan/23-thinking-renderer.md` | complete | main + subagents | Renderer; no hidden chain-of-thought. |
| 24 | Chat Citation Renderer | `plan/24-chat-citation-renderer.md` | complete | main + subagents | Renderer; citation metadata separation. |
| 25 | push_ui_message Example | `plan/25-push-ui-message.md` | complete | main + subagents | Generative UI; API version risk. |
| 26 | Multimodal Image Input | `plan/26-multimodal-image-input.md` | complete | main + subagents | Multimodal; image size/model limits. |
| 27 | Multimodal Voice Input | `plan/27-multimodal-voice-input.md` | complete | main + subagents | Multimodal; upload fallback for E2E. |
| 28 | Multimodal Voice Output | `plan/28-multimodal-voice-output.md` | complete | main + subagents | Multimodal; audio cleanup. |
| 29 | Chat Code Editor | `plan/29-chat-code-editor.md` | complete | main + subagents | Artifact; approval before apply. |
| 30 | Chat Document Artifact | `plan/30-chat-document-artifact.md` | complete | main + subagents | Artifact; section-level diffs. |
| 31 | Chat Plan Board | `plan/31-chat-plan-board.md` | complete | main + subagents | Artifact; user-edited steps. |
| 32 | Chat Graph Execution Canvas | `plan/32-chat-graph-execution-canvas.md` | complete | main + subagents | Artifact; shared event store. |
| 33 | Chat UI Preview | `plan/33-chat-ui-preview.md` | complete | main + subagents | Artifact; sandboxed preview. |
| 34 | Chat Data Analysis Canvas | `plan/34-chat-data-analysis-canvas.md` | complete | main + subagents | Artifact; sandboxed analysis. |
| 35 | Agentic Chat AG-UI | `plan/35-agentic-chat-ag-ui.md` | complete | main | Generative UI; CopilotKit AG-UI runtime and frontend tool middleware. |
| 36 | Backend Tool Rendering AG-UI | `plan/36-backend-tool-rendering-ag-ui.md` | complete | main | AG-UI Dojo; render Python backend tool execution in React. |
| 37 | Human in the Loop AG-UI | `plan/37-human-in-the-loop-ag-ui.md` | complete | main | AG-UI Dojo; interrupt/resume approval flow. |
| 38 | Agentic Generative UI AG-UI | `plan/38-agentic-generative-ui-ag-ui.md` | complete | main | AG-UI Dojo; long-running agent-generated task UI. |
| 39 | Tool Based Generative UI AG-UI | `plan/39-tool-based-generative-ui-ag-ui.md` | complete | main | AG-UI Dojo; backend tool returns custom UI payload. |
| 40 | Shared State Between Agent and UI AG-UI | `plan/40-shared-state-agent-ui-ag-ui.md` | complete | main | AG-UI Dojo; shared recipe state collaboration. |
| 41 | Predictive State Updates AG-UI | `plan/41-predictive-state-updates-ag-ui.md` | complete | main | AG-UI Dojo; optimistic document state updates. |
| 42 | Agentic Chat Reasoning AG-UI | `plan/42-agentic-chat-reasoning-ag-ui.md` | complete | main | AG-UI Dojo; public reasoning summaries only. |
| 43 | Agentic Chat Multimodal AG-UI | `plan/43-agentic-chat-multimodal-ag-ui.md` | complete | main | AG-UI Dojo; multimodal chat with image/media input. |
| 44 | Subgraphs AG-UI | `plan/44-subgraphs-ag-ui.md` | complete | main | AG-UI Dojo; multi-agent subgraph progress UI. |
| 45 | A2UI Fixed Schema AG-UI | `plan/45-a2ui-fixed-schema-ag-ui.md` | complete | main | AG-UI Dojo; fixed-schema flight card renderer. |
| 46 | A2UI Dynamic Schema AG-UI | `plan/46-a2ui-dynamic-schema-ag-ui.md` | complete | main | AG-UI Dojo; whitelisted dynamic schema renderer. |
| 47 | A2UI Advanced AG-UI | `plan/47-a2ui-advanced-ag-ui.md` | complete | main | AG-UI Dojo; dynamic A2UI with progress and actions. |
| 48 | Todo List Middleware | `plan/48-todo-list-middleware.md` | complete | main | LangChain middleware; `write_todos` state board and duplicate-call error path. |
| 49 | Loop Engineering Harness | `plan/49-loop-engineering-harness-ui.md` | complete | main | LangChain loop engineering article; agent, verification, event-driven, and hill-climbing loops. |

## Coordination Notes

- Reference graph review came from the `1-langgraph-basic` subproject and confirmed the key entrypoints: `b_01_simple`, `b_03_tool_node`, `b_05_interrupt`, `b_06_checkpointer`, `b_07_streaming`, `b_16_command_interrupt`, `b_17_configurable`, `b_18_custom_streaming`, `b_20_history_reducer`, `b_21_long_context`, and `b_25_approval_system`.
- Examples 35-47 map to the 13 AG-UI Dojo LangGraph feature demos in order, using Python LangGraph backend graphs plus TypeScript React frontend examples.
- Example 48 adds the LangChain `TodoListMiddleware` learning path, focused on full-list todo state replacement, `write_todos` tool visibility, and middleware duplicate-call handling.
- Example 49 adds the LangChain loop engineering learning path as a deterministic local harness with visible retry, trace, and improvement loops.
- Boilerplate can start next: workspace package setup, Python LangGraph project setup, shared SDK client, app shell, and MVP routes.


## 2026-10-06 · UI-GH-01 GitHub design system

- Status: complete. Shared UI design: `plan/github-design-system.md`. Browser plan: `e2e-plan/github-design-system.md`.
- Owner: Sol implementation agent; parent performs live browser verification.

## 2026-10-06 — UI-PUSH-CHAT-25 revision

Example 25 now uses MessagesState chat, three dummy-data internal LLM calls with progress UI, and a final answer call. Updated plan, E2E contract, stock, and flow. Earlier example-25 verification applies to the superseded action-card UI. Current runtime/browser verification and migration of the old E2E spec are pending.

## 2026-10-06 — UI-PUSH-TURN-25

Refined example 25 to one Assistant message per turn: persisted empty placeholder, work-start UI, three public progress summaries, and final answer replacement by ID. Failed turns persist and stop subsequent calls. Empty placeholders are excluded from model context. Stock and example plan/E2E contract synchronized. Current validation: TypeScript lint, production build, and graph import/structure inspection; live provider/browser acceptance remains unverified.

## 2026-10-06 — UI-PUSH-STATE-25 cleanup

Removed redundant answer/final/ui_render_status/workflow_id from example 25. error and final_status remain functional frontend inputs. Derived UI IDs use the Assistant ID. Updated stock, plan, E2E contract, and flow. Graph import/compilation and schema inspection passed; no automated tests or provider/browser execution.

## 2026-10-06 — UI-PUSH-EDGES-25

Example 25 now declares each node and connection explicitly, with a shared route_after_stage function and named destinations. Removed registration/edge loops and tuple indices. Graph import/compilation confirmed; no runtime/provider tests.

## 2026-10-06 — UI-PUSH-ID-25

Assistant IDs are generated only in prepare_prompt on every turn. Removed old-state fallback, collision check, and frontend Assistant ID input/draft. Frontend uses the preparation update for the response bubble. TypeScript and graph compilation checks; live provider/browser checks remain pending.

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

## 2026-10-07 EXAMPLES-REMEDA-07 in progress

All example utility refactor delegated by disjoint folder groups; root handles25 and dependency/integration. See plan/examples-remeda-refactor.md.

## 2026-10-07 EXAMPLES-REMEDA-07 complete

54/54folders covered,94files importRemeda; no sibling imports/custom isRecord wrappers. Scoped lint/typecheck/build passed. Domain reducers/native browser logic preserved; no tests/E2E rerun. See docs/flow/2026-10-07-examples-remeda.md.
