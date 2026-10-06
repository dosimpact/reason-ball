# 05 Tool Calling ReAct UI

## Coding Scope

- Graph: `graphs/05_tool_calling_react.py` adapts `03_tool_node`.
- Frontend: `src/examples/05-tool-calling-react-ui/` displays tool calls inside a chat-style flow.

## Implementation Plan

1. Provide a simple deterministic tool plus one LLM-selected tool path.
2. Stream assistant messages and tool events as separate UI items.
3. Render tool cards with name, arguments, status, result, and error state.
4. Add sample prompts that reliably trigger the tool.

## SDK And State Notes

Use `streamMode: ["messages", "updates"]` so assistant text arrives from the message stream while tool call metadata and tool result messages arrive from update chunks. Normalize tool call metadata from AI messages and tool result messages. Keep raw args/result available for inspection.

## Risks

- Tool call metadata differs between model providers and message wrappers.
- Tool failures must remain visible and not be collapsed into a generic assistant error.

## Acceptance Criteria

- Tool calls are visually separate from assistant text.
- In-progress, success, and error tool states are visible.
- Final assistant response references the tool result.

---

## 한국어

# 05 도구 호출 ReAct UI

## 코딩 범위

- 그래프: `graphs/05_tool_calling_react.py`는 `03_tool_node`를 적용합니다.
- 프런트엔드: `src/examples/05-tool-calling-react-ui/`는 채팅 스타일 흐름 내에 도구 호출을 표시합니다.

## 구현 계획

1. 간단한 결정론적 도구와 하나의 LLM 선택 도구 경로를 제공합니다.
2. 보조 메시지와 도구 이벤트를 별도의 UI 항목으로 스트리밍합니다.
3. 이름, 인수, 상태, 결과 및 오류 상태가 포함된 도구 카드를 렌더링합니다.
4. 도구를 안정적으로 트리거하는 샘플 프롬프트를 추가합니다.

## SDK 및 상태 참고 사항

도구 호출 메타데이터 및 도구 결과 메시지가 업데이트 청크에서 도착하는 동안 어시스턴트 텍스트가 메시지 스트림에서 도착하도록 `streamMode: ["messages", "updates"]`를 사용합니다. AI 메시지 및 도구 결과 메시지의 도구 호출 메타데이터를 정규화합니다. 검사를 위해 원시 인수/결과를 유지하세요.

## 위험

- 도구 호출 메타데이터는 모델 공급자와 메시지 래퍼 간에 다릅니다.
- 도구 오류는 계속 표시되어야 하며 일반 어시스턴트 오류로 축소되어서는 안 됩니다.

## 승인 기준

- 도구 호출은 어시스턴트 텍스트와 시각적으로 구분됩니다.
- 진행 중, 성공, 오류 도구 상태가 표시됩니다.
- 최종 어시스턴트 응답은 도구 결과를 참조합니다.


## EXAMPLES-LAYERS-06: 05-2-tool-calling-react-hook

- `ToolCallingReactHookExample.tsx`: screen composition and DOM event binding.
- `useToolCallingReactHook.ts`: SDK requests, stream callbacks, and derived view values.
- `useToolCallingReactHookState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useToolCallingReactHook`는 SDK 요청·스트림·파생값을 관리한다. `useToolCallingReactHookState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.


## EXAMPLES-LAYERS-06: 05-tool-calling-react-ui

- `ToolCallingReactExample.tsx`: screen composition and DOM event binding.
- `useToolCallingReact.ts`: SDK requests, stream callbacks, and derived view values.
- `useToolCallingReactState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useToolCallingReact`는 SDK 요청·스트림·파생값을 관리한다. `useToolCallingReactState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
