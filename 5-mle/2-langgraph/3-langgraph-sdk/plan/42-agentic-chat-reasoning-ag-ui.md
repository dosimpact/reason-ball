# 42 Agentic Chat Reasoning AG-UI

## Coding Scope

- Graph: `graphs/42_agentic_chat_reasoning_ag_ui.py` implements a Python chat agent that exposes safe reasoning summaries and frontend/backend tools.
- Frontend: `src/examples/42-agentic-chat-reasoning-ag-ui/` renders CopilotKit chat with collapsible reasoning/status blocks.
- Runtime: reuse the shared CopilotKit runtime.

## Implementation Plan

1. Add an `42_agentic_chat_reasoning` graph using the shared model factory and a prompt that emits concise public reasoning summaries or status notes.
2. Include at least one frontend or backend tool so the example remains comparable to Agentic Chat.
3. Stream reasoning/status summaries as explicit public metadata or custom messages, not hidden chain-of-thought.
4. Add a React chat example with a collapsible reasoning block attached to assistant responses.
5. Clearly separate reasoning summary, tool activity, and final answer in the UI.
6. Register graph, runtime agent, example metadata, and route as example 42.

## SDK And State Notes

Only provider-approved reasoning summaries or graph-authored status messages may be shown. The implementation must not request, store, or display hidden chain-of-thought.

## Risks

- Some models may not provide reasoning summary fields, so graph-authored status messages may be needed for deterministic UI behavior.
- Reasoning content can be confused with final answer text if not rendered separately.
- Tool streaming and reasoning streaming can interleave.

## Acceptance Criteria

- The Agentic Chat Reasoning AG-UI example appears as example 42 in the navigation.
- A representative prompt shows a collapsible public reasoning/status block.
- The final answer remains separate from the reasoning summary.
- Tool activity still renders when a tool is invoked.
- No hidden chain-of-thought text is requested or displayed.

---

## 한국어

# 42 에이전트 채팅 추론 AG-UI

## 코딩 범위

- 그래프: `graphs/42_agentic_chat_reasoning_ag_ui.py`는 안전한 추론 요약과 프런트엔드/백엔드 도구를 노출하는 Python 채팅 에이전트를 구현합니다.
- 프런트엔드: `src/examples/42-agentic-chat-reasoning-ag-ui/`는 축소 가능한 추론/상태 블록을 사용하여 CopilotKit 채팅을 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임을 재사용합니다.

## 구현 계획

1. 공유 모델 팩토리와 간결한 공개 추론 요약 또는 상태 메모를 내보내는 프롬프트를 사용하여 `42_agentic_chat_reasoning` 그래프를 추가합니다.
2. 예가 Agentic Chat과 비교 가능하도록 하나 이상의 프런트엔드 또는 백엔드 도구를 포함합니다.
3. 숨겨진 사고방식이 아닌 명시적인 공개 메타데이터 또는 사용자 정의 메시지로 추론/상태 요약을 스트리밍합니다.
4. 어시스턴트 응답에 첨부된 축소 가능한 추론 블록이 있는 React 채팅 예제를 추가합니다.
5. UI에서 추론 요약, 도구 활동, 최종 답변을 명확하게 구분합니다.
6. 예제 42와 같이 그래프, 런타임 에이전트, 예제 메타데이터 및 경로를 등록합니다.

## SDK 및 상태 참고 사항

공급자가 승인한 추론 요약 또는 그래프로 작성된 상태 메시지만 표시될 수 있습니다. 구현 시 숨겨진 생각의 사슬을 요청, 저장 또는 표시해서는 안 됩니다.

## 위험

- 일부 모델은 추론 요약 필드를 제공하지 않을 수 있으므로 결정적 UI 동작을 위해 그래프로 작성된 상태 메시지가 필요할 수 있습니다.
- 추론 내용을 별도로 렌더링하지 않을 경우 최종 답변 텍스트와 혼동될 수 있습니다.
- 도구 스트리밍과 추론 스트리밍이 인터리브될 수 있습니다.

## 승인 기준

- Agentic Chat Reasoning AG-UI 예제는 탐색에서 예제 42로 나타납니다.
- 대표 프롬프트에는 축소 가능한 공개 추론/상태 블록이 표시됩니다.
- 최종 답변은 추론 요약과 별도로 유지됩니다.
- 도구가 호출되면 도구 활동이 계속 렌더링됩니다.
- 숨겨진 생각의 사슬 텍스트가 요청되거나 표시되지 않습니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `AgenticChatReasoningAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `AgenticChatReasoningAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `styles.ts` | Local presentation styles / 로컬 표시 스타일 |
| `useAgenticChatReasoningAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
