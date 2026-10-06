# 06 Human-in-the-loop Interrupt UI

## Coding Scope

- Graph: `graphs/06_human_in_the_loop_interrupt.py` adapts `05_interrupt`, `16_command_interrupt`, and `25_approval_system`.
- Frontend: `src/examples/06-human-in-the-loop-interrupt-ui/` handles pending interrupt runs.

## Implementation Plan

1. Create a graph that interrupts with an approval payload before a sensitive action.
2. Render interrupt payload, approve, reject, and edit-then-approve actions.
3. Resume with `Command(resume=...)` through the SDK.
4. On refresh, detect pending thread/run state and restore the action panel.

## SDK And State Notes

Track run id, thread id, interrupt payload, and resume payload. Keep approval decisions in graph state for final display.

## Risks

- Duplicate resume actions can corrupt the learning flow; resume buttons need disabled/loading states.
- Pending interrupt recovery depends on stable thread and run references after refresh.

## Acceptance Criteria

- A run stops at interrupt and does not complete until user action.
- Approval, rejection, and edited approval each resume the same thread.
- Refreshing the page does not lose the pending interrupt.

---

## 한국어

# 06 Human-in-the-Loop 인터럽트 UI

## 코딩 범위

- 그래프: `graphs/06_human_in_the_loop_interrupt.py`는 `05_interrupt`, `16_command_interrupt` 및 `25_approval_system`를 적용합니다.
- 프런트엔드: `src/examples/06-human-in-the-loop-interrupt-ui/`는 보류 중인 인터럽트 실행을 처리합니다.

## 구현 계획

1. 민감한 작업 이전에 승인 페이로드로 중단되는 그래프를 만듭니다.
2. 인터럽트 페이로드를 렌더링하고, 승인, 거부 및 편집 후 승인 작업을 수행합니다.
3. SDK를 통해 `Command(resume=...)`로 재개합니다.
4. 새로 고침 시 보류 중인 스레드/실행 상태를 감지하고 작업 패널을 복원합니다.

## SDK 및 상태 참고 사항

실행 ID, 스레드 ID, 인터럽트 페이로드 및 재개 페이로드를 추적합니다. 최종 표시를 위해 승인 결정을 그래프 상태로 유지합니다.

## 위험

- 중복된 재개 작업으로 인해 학습 흐름이 손상될 수 있습니다. 재개 버튼은 비활성화/로드 상태가 필요합니다.
- 보류 중인 인터럽트를 복구하려면 새로 고침 후에도 스레드와 실행 참조가 안정적으로 유지되어야 합니다.

## 승인 기준

- 실행은 인터럽트 시 중지되고 사용자 조치까지 완료되지 않습니다.
- 승인, 거부, 수정된 승인은 각각 동일한 스레드를 재개합니다.
- 페이지를 새로 고쳐도 보류 중인 인터럽트가 손실되지 않습니다.


## EXAMPLES-LAYERS-06: 06-2-human-in-the-loop-react-hook

- `HumanInTheLoopReactHookExample.tsx`: screen composition and DOM event binding.
- `useHumanInTheLoopReactHook.ts`: SDK requests, stream callbacks, and derived view values.
- `useHumanInTheLoopReactHookState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useHumanInTheLoopReactHook`는 SDK 요청·스트림·파생값을 관리한다. `useHumanInTheLoopReactHookState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.


## EXAMPLES-LAYERS-06: 06-human-in-the-loop-interrupt-ui

- `HumanInTheLoopInterruptExample.tsx`: screen composition and DOM event binding.
- `useHumanInTheLoopInterrupt.ts`: SDK requests, stream callbacks, and derived view values.
- `useHumanInTheLoopInterruptState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.
- `pendingThreadStorage.ts`: browser persistence for pending approval.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useHumanInTheLoopInterrupt`는 SDK 요청·스트림·파생값을 관리한다. `useHumanInTheLoopInterruptState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
