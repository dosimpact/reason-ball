# 14 Plan-and-Execute UI

## Coding Scope

- Graph: `graphs/14_plan_and_execute.py` adapts `13_plan_and_execute`.
- Frontend: `src/examples/14-plan-and-execute-ui/` separates plan generation from step execution.

## Implementation Plan

1. Build a planner node that creates a small ordered step list.
2. Build executor nodes that update step status.
3. Render planned, active, completed, failed, and replanned states.
4. Add controls for stop and replan if supported by graph state.

## SDK And State Notes

Keep plan steps as structured objects with id, title, status, result, and error. Stream updates per step.

## Risks

- Plans can change during execution; the UI must handle inserted, removed, or rewritten steps.
- Stop/replan controls need clear disabled states while a run is active.

## Acceptance Criteria

- Users can see the plan before all execution is complete.
- Active and completed steps are visually distinct.
- Replanning or stop behavior is reflected in graph state.

---

## 한국어

# 14 계획 및 실행 UI

## 코딩 범위

- 그래프: `graphs/14_plan_and_execute.py`는 `13_plan_and_execute`를 적용합니다.
- 프런트엔드: `src/examples/14-plan-and-execute-ui/`는 계획 생성과 단계 실행을 분리합니다.

## 구현 계획

1. 작은 순서의 단계 목록을 생성하는 플래너 노드를 구축합니다.
2. 단계 상태를 업데이트하는 실행기 노드를 구축합니다.
3. 계획됨, 활성, 완료됨, 실패함 및 재계획됨 상태를 렌더링합니다.
4. 그래프 상태에서 지원하는 경우 중지 및 재계획에 대한 제어를 추가합니다.

## SDK 및 상태 참고 사항

계획 단계를 ID, 제목, 상태, 결과 및 오류가 포함된 구조화된 개체로 유지합니다. 단계별로 업데이트를 스트리밍하세요.

## 위험

- 계획은 실행 중에 변경될 수 있습니다. UI는 삽입, 제거 또는 다시 작성된 단계를 처리해야 합니다.
- 중지/재계획 제어는 실행이 활성화된 동안 명확한 비활성화 상태가 필요합니다.

## 승인 기준

- 모든 실행이 완료되기 전에 사용자는 계획을 볼 수 있습니다.
- 활성 단계와 완료된 단계가 시각적으로 구분됩니다.
- 재계획 또는 중지 동작이 그래프 상태에 반영됩니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `PlanAndExecuteExample.tsx`: screen composition.
- `usePlanAndExecute.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `usePlanAndExecuteState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed ExecutionStatusPanel, ReplanStopControlsPanel, PlanStepsPanel, ExecutorOutputPanel, StepEventsPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `PlanAndExecuteExample.tsx`: 화면 조합.
- `usePlanAndExecute.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `usePlanAndExecuteState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
