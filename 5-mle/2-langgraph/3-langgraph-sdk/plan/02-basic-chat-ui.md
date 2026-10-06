# 02 Basic Chat UI

## Coding Scope

- Graph: `graphs/02_basic_chat.py` adapts sibling examples `02_llm_graph` and `06_checkpointer` into a checkpointed chat graph.
- Frontend: `src/examples/02-basic-chat-ui/` implements a multi-turn chat route.
- Shared code: message normalization utilities for Human, AI, Tool, and system-like metadata.

## Implementation Plan

1. Build a chat graph that accepts `messages` and persists state by `thread_id`.
2. Register the graph and expose a stable assistant id for the example.
3. Add a conversation sidebar with new thread, previous thread selection, and delete.
4. Stream assistant output into the message list while preserving final thread state.

## SDK And State Notes

Use thread-scoped runs. Store thread metadata locally enough to switch conversations, but treat LangGraph state as authoritative.

## Risks

- LLM responses are nondeterministic, so tests should assert continuity and UI state rather than exact wording.
- Thread id handling must be stable or history reuse will appear broken.

## Acceptance Criteria

- Sending a second message on the same thread includes prior context.
- Switching to an older thread restores visible history.
- Loading and send states are distinct from assistant message content.

---

## 한국어

# 02 기본 채팅 UI

## 코딩 범위

- 그래프: `graphs/02_basic_chat.py`는 형제 예제 `02_llm_graph` 및 `06_checkpointer`를 체크포인트 채팅 그래프에 적용합니다.
- 프런트엔드: `src/examples/02-basic-chat-ui/`는 다중 회전 채팅 경로를 구현합니다.
- 공유 코드: 인간, AI, 도구 및 시스템과 유사한 메타데이터에 대한 메시지 정규화 유틸리티입니다.

## 구현 계획

1. `messages`를 허용하고 `thread_id`에 의해 상태를 유지하는 채팅 그래프를 구축합니다.
2. 그래프를 등록하고 예시를 위해 안정적인 어시스턴트 ID를 노출합니다.
3. 새 스레드, 이전 스레드 선택 및 삭제가 포함된 대화 사이드바를 추가합니다.
4. 최종 스레드 상태를 유지하면서 스트림 도우미 출력을 메시지 목록으로 보냅니다.

## SDK 및 상태 참고 사항

스레드 범위 실행을 사용합니다. 대화를 전환할 수 있을 만큼 스레드 메타데이터를 로컬에 저장하지만 LangGraph 상태를 신뢰할 수 있는 것으로 취급합니다.

## 위험

- LLM 응답은 비결정적이므로 테스트는 정확한 표현보다는 연속성과 UI 상태를 확인해야 합니다.
- 스레드 ID 처리가 안정적이어야 합니다. 그렇지 않으면 기록 재사용이 손상된 것으로 나타납니다.

## 승인 기준

- 동일한 스레드에서 두 번째 메시지를 보내는 데에는 이전 컨텍스트가 포함됩니다.
- 이전 스레드로 전환하면 표시되는 기록이 복원됩니다.
- 로드 및 전송 상태는 보조 메시지 내용과 다릅니다.


## EXAMPLES-LAYERS-06: 02-2-basic-chat-react-hook

- `BasicChatReactHookExample.tsx`: screen composition and DOM event binding.
- `useBasicChatReactHook.ts`: SDK requests, stream callbacks, and derived view values.
- `useBasicChatReactHookState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useBasicChatReactHook`는 SDK 요청·스트림·파생값을 관리한다. `useBasicChatReactHookState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.


## EXAMPLES-LAYERS-06: 02-basic-chat-ui

- `BasicChatExample.tsx`: screen composition and DOM event binding.
- `useBasicChat.ts`: SDK requests, stream callbacks, and derived view values.
- `useBasicChatState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useBasicChat`는 SDK 요청·스트림·파생값을 관리한다. `useBasicChatState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
