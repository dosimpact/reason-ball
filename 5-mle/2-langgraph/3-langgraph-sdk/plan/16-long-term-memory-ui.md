# 16 Long-term Memory UI

## Coding Scope

- Graph: `graphs/16_long_term_memory.py` adapts `15_long_term_memory`.
- Frontend: `src/examples/16-long-term-memory-ui/` distinguishes thread state from cross-thread memory.

## Implementation Plan

1. Build graph support for user-scoped memory read/write operations.
2. Add memory list, create, edit, and delete UI.
3. Show thread messages beside durable memories.
4. Demonstrate memory reuse across a new thread for the same user id.

## SDK And State Notes

State should include thread-scoped messages, memory operations, user id, and current store snapshot.

## Risks

- User id scoping mistakes can leak memories between examples or test users.
- Store cleanup is required for repeatable tests.

## Acceptance Criteria

- A memory created in one thread is visible in another thread.
- Users can edit and delete memories.
- Thread-local and long-term data are visually separate.

---

## 한국어

#16 장기기억 UI

## 코딩 범위

- 그래프: `graphs/16_long_term_memory.py`는 `15_long_term_memory`를 적용합니다.
- 프런트엔드: `src/examples/16-long-term-memory-ui/`는 스레드 상태를 크로스 스레드 메모리와 구별합니다.

## 구현 계획

1. 사용자 범위 메모리 읽기/쓰기 작업에 대한 그래프 지원을 구축합니다.
2. 메모리 목록을 추가하고 UI를 생성, 편집, 삭제합니다.
3. 지속 가능한 추억 옆에 스레드 메시지를 표시합니다.
4. 동일한 사용자 ID에 대해 새 스레드에서 메모리 재사용을 보여줍니다.

## SDK 및 상태 참고 사항

상태에는 스레드 범위 메시지, 메모리 작업, 사용자 ID 및 현재 저장소 스냅샷이 포함되어야 합니다.

## 위험

- 사용자 ID 범위 지정 실수로 인해 예제 또는 테스트 사용자 간에 메모리가 유출될 수 있습니다.
- 반복 가능한 테스트를 위해서는 매장 정리가 필요합니다.

## 승인 기준

- 한 스레드에서 생성된 메모리는 다른 스레드에서도 볼 수 있습니다.
- 사용자는 추억을 편집하고 삭제할 수 있습니다.
- 스레드 로컬 데이터와 장기 데이터가 시각적으로 구분됩니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `LongTermMemoryExample.tsx`: screen composition.
- `useLongTermMemory.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useLongTermMemoryState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed DurableMemoriesPanel, ThreadStatePanel, CrossThreadProofPanel, MemoryEventsPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `LongTermMemoryExample.tsx`: 화면 조합.
- `useLongTermMemory.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useLongTermMemoryState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
