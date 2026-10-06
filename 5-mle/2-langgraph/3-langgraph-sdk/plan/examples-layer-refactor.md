# EXAMPLES-LAYERS-06: independent frontend layers

## Scope

Refactor all 53 example folders other than the already layered example 25. Keep each public entry component, graph/agent ID, payload, stream mode, runtime configuration and user-visible behavior. Preserve existing working-tree edits.

## Responsibilities

- Entry: compose views and bind DOM events.
- Request/controller hook: SDK/CopilotKit operations and stream lifecycle; no DOM events where practical.
- State hook: local useState and related state transitions when distinct from orchestration.
- Data module: types, fixtures, pure parsing/normalization/merging/selectors.
- Presentation components: sizable independent renderers and panels.

Choose modules based on each example's actual responsibilities. Keep all new code inside that example's folder. Existing shared lib/components/hooks may remain, but add no imports from sibling example folders and no generic abstraction coupling examples. Do not add tiny pass-through services or impose identical module counts. Preserve CopilotKit provider boundaries and hook execution order.

## Work ownership

- Worker A: examples 01–12, including all React-hook variants.
- Worker B: examples 13–24.
- Worker C: examples 26–34 plus 48–49.
- Root: examples 35–47, consolidated documentation and integration review.

Workers read each existing plan and append a bilingual module map to that example's plan. Only root edits stock, flow and shared progress documents.

## Acceptance

Every folder has a reviewed responsibility split, preserved public entry and no newly introduced sibling-example dependency. Pure data modules do not import React. No dependency/lockfile/server/graph changes. Scoped TypeScript lint and production build are integration checks; all-example live-provider E2E is not included in this request.

---

## 한국어

25번을 제외한 53개 예제 폴더를 검토하고 책임별로 분리한다. 진입 컴포넌트·그래프 ID·입력값·스트림 모드·화면 동작은 보존한다. 화면 구성, 요청 흐름, 상태 전환, 순수 데이터 변환, 큰 표시 컴포넌트는 해당 예제 폴더 안에서 나눈다. 실제 책임에 맞게 필요한 파일만 만들고, 다른 예제 폴더를 가져오는 새로운 의존성은 만들지 않는다. 기존 공통 lib/components/hooks는 유지한다. CopilotKit provider 경계와 훅 호출 순서는 보존한다. 개별 계획에는 파일 역할을 영문과 한국어로 기록하고, 저량·유량·진행 문서는 루트 에이전트가 통합한다. 완료 기준은 전체 범위 점검, 독립성 유지, 타입 검사와 빌드 통과이며 전체 실제 provider E2E는 이번 요청 범위에 포함하지 않는다.

## Inventory / 예제별 모듈 현황

| Example / 예제 | Public entry / 진입점 | TS modules / 모듈 수 |
|---|---|---:|
| `01-2-sdk-connection-react-hook` | `SdkConnectionReactHookExample.tsx` | 5 |
| `01-sdk-connection` | `SdkConnectionExample.tsx` | 4 |
| `02-2-basic-chat-react-hook` | `BasicChatReactHookExample.tsx` | 5 |
| `02-basic-chat-ui` | `BasicChatExample.tsx` | 5 |
| `03-graph-execution-timeline` | `GraphExecutionTimelineExample.tsx` | 5 |
| `04-2-streaming-react-hook` | `StreamingReactHookExample.tsx` | 5 |
| `04-streaming-ui` | `StreamingUiExample.tsx` | 5 |
| `05-2-tool-calling-react-hook` | `ToolCallingReactHookExample.tsx` | 5 |
| `05-tool-calling-react-ui` | `ToolCallingReactExample.tsx` | 5 |
| `06-2-human-in-the-loop-react-hook` | `HumanInTheLoopReactHookExample.tsx` | 5 |
| `06-human-in-the-loop-interrupt-ui` | `HumanInTheLoopInterruptExample.tsx` | 6 |
| `07-checkpoint-state-history-ui` | `CheckpointStateHistoryExample.tsx` | 5 |
| `08-time-travel-replay-ui` | `TimeTravelReplayExample.tsx` | 5 |
| `09-conditional-routing-ui` | `ConditionalRoutingExample.tsx` | 5 |
| `10-subgraph-nested-execution-ui` | `SubgraphNestedExecutionExample.tsx` | 5 |
| `11-parallel-map-reduce-ui` | `ParallelMapReduceExample.tsx` | 5 |
| `12-structured-output-ui` | `StructuredOutputExample.tsx` | 5 |
| `13-rag-qa-ui` | `RagQaExample.tsx` | 7 |
| `14-plan-and-execute-ui` | `PlanAndExecuteExample.tsx` | 7 |
| `15-reflection-evaluator-loop-ui` | `ReflectionEvaluatorLoopExample.tsx` | 7 |
| `16-long-term-memory-ui` | `LongTermMemoryExample.tsx` | 7 |
| `17-configurable-assistant-ui` | `ConfigurableAssistantExample.tsx` | 7 |
| `18-retry-error-degradation-ui` | `RetryErrorDegradationExample.tsx` | 7 |
| `19-long-context-ui` | `LongContextExample.tsx` | 7 |
| `20-observability-ui` | `ObservabilityExample.tsx` | 7 |
| `21-intent-feedback-generative-ui` | `IntentFeedbackGenerativeExample.tsx` | 7 |
| `22-custom-event-renderer` | `CustomEventRendererExample.tsx` | 7 |
| `23-thinking-renderer` | `ThinkingRendererExample.tsx` | 7 |
| `24-chat-citation-renderer` | `ChatCitationRendererExample.tsx` | 7 |
| `25-push-ui-message` | `PushUiMessageExample.tsx` | 8 |
| `26-multimodal-image-input` | `MultimodalImageInputExample.tsx` | 13 |
| `27-multimodal-voice-input` | `MultimodalVoiceInputExample.tsx` | 14 |
| `28-multimodal-voice-output` | `MultimodalVoiceOutputExample.tsx` | 12 |
| `29-chat-code-editor` | `ChatCodeEditorExample.tsx` | 14 |
| `30-chat-document-artifact` | `ChatDocumentArtifactExample.tsx` | 15 |
| `31-chat-plan-board` | `ChatPlanBoardExample.tsx` | 13 |
| `32-chat-graph-execution-canvas` | `ChatGraphExecutionCanvasExample.tsx` | 15 |
| `33-chat-ui-preview` | `ChatUiPreviewExample.tsx` | 16 |
| `34-chat-data-analysis-canvas` | `ChatDataAnalysisCanvasExample.tsx` | 17 |
| `35-agentic-chat-ag-ui` | `AgenticChatAgUiExample.tsx` | 5 |
| `36-backend-tool-rendering-ag-ui` | `BackendToolRenderingAgUiExample.tsx` | 6 |
| `37-human-in-the-loop-ag-ui` | `HumanInTheLoopAgUiExample.tsx` | 6 |
| `38-agentic-generative-ui-ag-ui` | `AgenticGenerativeUiAgUiExample.tsx` | 6 |
| `39-tool-based-generative-ui-ag-ui` | `ToolBasedGenerativeUiAgUiExample.tsx` | 6 |
| `40-shared-state-agent-ui-ag-ui` | `SharedStateAgentUiAgUiExample.tsx` | 7 |
| `41-predictive-state-updates-ag-ui` | `PredictiveStateUpdatesAgUiExample.tsx` | 7 |
| `42-agentic-chat-reasoning-ag-ui` | `AgenticChatReasoningAgUiExample.tsx` | 6 |
| `43-agentic-chat-multimodal-ag-ui` | `AgenticChatMultimodalAgUiExample.tsx` | 8 |
| `44-subgraphs-ag-ui` | `SubgraphsAgUiExample.tsx` | 5 |
| `45-a2ui-fixed-schema-ag-ui` | `A2uiFixedSchemaAgUiExample.tsx` | 5 |
| `46-a2ui-dynamic-schema-ag-ui` | `A2uiDynamicSchemaAgUiExample.tsx` | 5 |
| `47-a2ui-advanced-ag-ui` | `A2uiAdvancedAgUiExample.tsx` | 5 |
| `48-todo-list-middleware` | `TodoListMiddlewareExample.tsx` | 11 |
| `49-loop-engineering-harness-ui` | `LoopEngineeringHarnessExample.tsx` | 9 |
