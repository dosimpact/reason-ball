# 10 Subgraph Nested Execution UI

## Coding Scope

- Graph: `graphs/10_subgraph_nested_execution.py` adapts `04_subgraph`, `11_2_supervisor`, and `11_4_supervisor_chat_subgraph`.
- Frontend: `src/examples/10-subgraph-nested-execution-ui/` renders parent and child execution.

## Implementation Plan

1. Build a parent graph with one or more named subgraphs.
2. Stream parent updates and nested subgraph updates with path metadata.
3. Render a collapsible tree and breadcrumb like `supervisor > team > worker`.
4. Separate parent messages/state from subgraph messages/state.

## SDK And State Notes

Prefer event metadata paths over string parsing. Keep a raw event viewer for nested stream payloads.

## Risks

- Nested stream metadata can be runtime-version dependent.
- Deep trees can overwhelm the page without collapsible defaults.

## Acceptance Criteria

- Parent graph and subgraph execution are visually distinct.
- Users can expand subgraph details on demand.
- Breadcrumbs identify the active nested node path.

---

## 한국어

# 10 하위 그래프 중첩 실행 UI

## 코딩 범위

- 그래프: `graphs/10_subgraph_nested_execution.py`는 `04_subgraph`, `11_2_supervisor` 및 `11_4_supervisor_chat_subgraph`를 적용합니다.
- 프런트엔드: `src/examples/10-subgraph-nested-execution-ui/`는 상위 및 하위 실행을 렌더링합니다.

## 구현 계획

1. 하나 이상의 명명된 하위 그래프를 사용하여 상위 그래프를 만듭니다.
2. 경로 메타데이터를 사용하여 상위 업데이트 및 중첩된 하위 그래프 업데이트를 스트리밍합니다.
3. `supervisor > team > worker`와 같은 접이식 트리와 탐색경로를 렌더링합니다.
4. 상위 메시지/상태를 하위 메시지/상태와 분리합니다.

## SDK 및 상태 참고 사항

문자열 구문 분석보다 이벤트 메타데이터 경로를 선호합니다. 중첩된 스트림 페이로드에 대한 원시 이벤트 뷰어를 유지합니다.

## 위험

- 중첩된 스트림 메타데이터는 런타임 버전에 따라 달라질 수 있습니다.
- 깊은 나무는 접을 수 있는 기본값 없이 페이지를 압도할 수 있습니다.

## 승인 기준

- 상위 그래프와 하위 그래프 실행이 시각적으로 구분됩니다.
- 사용자는 필요에 따라 하위 그래프 세부 정보를 확장할 수 있습니다.
- 이동 경로는 활성 중첩 노드 경로를 식별합니다.


## EXAMPLES-LAYERS-06: 10-subgraph-nested-execution-ui

- `SubgraphNestedExecutionExample.tsx`: screen composition and DOM event binding.
- `useSubgraphNestedExecution.ts`: SDK requests, stream callbacks, and derived view values.
- `useSubgraphNestedExecutionState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useSubgraphNestedExecution`는 SDK 요청·스트림·파생값을 관리한다. `useSubgraphNestedExecutionState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
