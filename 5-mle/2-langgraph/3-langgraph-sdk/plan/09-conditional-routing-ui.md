# 09 Conditional Routing UI

## Coding Scope

- Graph: `graphs/09_conditional_routing.py` adapts `04_subgraph` and `11_1_supervisor`.
- Frontend: `src/examples/09-conditional-routing-ui/` visualizes branch decisions.

## Implementation Plan

1. Create a graph with at least two named conditional branches.
2. Emit or expose routing decision metadata in state updates.
3. Render branch cards with selected and skipped status.
4. Provide sample inputs that trigger different routes.

## SDK And State Notes

Stream `updates` so branch selection appears before final output. Store selected branch, reason, and skipped branch names.

## Risks

- Branch decisions may be implicit in graph edges unless the graph writes explicit route metadata.
- LLM-based routing can be flaky; use deterministic routing inputs for tests.

## Acceptance Criteria

- Different inputs select different branches.
- Selected branch is emphasized and skipped branches remain visible.
- The routing reason is visible in a structured panel.

---

## 한국어

#09 조건부 라우팅 UI

## 코딩 범위

- 그래프: `graphs/09_conditional_routing.py`는 `04_subgraph` 및 `11_1_supervisor`를 적용합니다.
- 프런트엔드: `src/examples/09-conditional-routing-ui/`는 분기 결정을 시각화합니다.

## 구현 계획

1. 명명된 조건부 분기가 두 개 이상 있는 그래프를 만듭니다.
2. 상태 업데이트에서 라우팅 결정 메타데이터를 내보내거나 노출합니다.
3. 선택 및 건너뛴 상태의 분기 카드를 렌더링합니다.
4. 다양한 경로를 트리거하는 샘플 입력을 제공합니다.

## SDK 및 상태 참고 사항

`updates`를 스트리밍하면 최종 출력 전에 분기 선택이 표시됩니다. 선택한 분기, 이유, 건너뛴 분기 이름을 저장합니다.

## 위험

- 그래프가 명시적인 경로 메타데이터를 작성하지 않는 한 분기 결정은 그래프 가장자리에 암시적으로 포함될 수 있습니다.
- LLM 기반 라우팅은 불안정할 수 있습니다. 테스트에는 결정론적 라우팅 입력을 사용합니다.

## 승인 기준

- 다른 입력은 다른 분기를 선택합니다.
- 선택한 분기가 강조되고 건너뛴 분기가 계속 표시됩니다.
- 라우팅 이유는 구조화된 패널에서 볼 수 있습니다.


## EXAMPLES-LAYERS-06: 09-conditional-routing-ui

- `ConditionalRoutingExample.tsx`: screen composition and DOM event binding.
- `useConditionalRouting.ts`: SDK requests, stream callbacks, and derived view values.
- `useConditionalRoutingState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useConditionalRouting`는 SDK 요청·스트림·파생값을 관리한다. `useConditionalRoutingState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
