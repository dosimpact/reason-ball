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

## Coordination Notes

- Reference graph review came from the `1-langgraph-basic` subproject and confirmed the key entrypoints: `b_01_simple`, `b_03_tool_node`, `b_05_interrupt`, `b_06_checkpointer`, `b_07_streaming`, `b_16_command_interrupt`, `b_17_configurable`, `b_18_custom_streaming`, `b_20_history_reducer`, `b_21_long_context`, and `b_25_approval_system`.
- Boilerplate can start next: workspace package setup, Python LangGraph project setup, shared SDK client, app shell, and MVP routes.
