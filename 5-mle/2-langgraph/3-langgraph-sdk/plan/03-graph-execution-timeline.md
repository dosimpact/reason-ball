# 03 Graph Execution Timeline

## Coding Scope

- Graph: `graphs/03_graph_execution_timeline.py` adapts `01_simple_graph` and streaming behavior from `07_streaming`.
- Frontend: `src/examples/03-graph-execution-timeline/` renders node status cards and state panels.

## Implementation Plan

1. Define a small multi-node graph with deterministic node names and visible state updates.
2. Stream `updates` and map each update to `pending`, `running`, `done`, `error`, or `skipped`.
3. Render a horizontal or vertical timeline with current node emphasis.
4. Show final state beside per-node updates for comparison.

## SDK And State Notes

The UI should consume stream events rather than inferring progress from final output. Keep a normalized event store keyed by node name.

## Risks

- Stream events can arrive quickly or out of expected visual order; the event reducer must be idempotent.
- Skipped nodes may need explicit graph metadata if the runtime does not emit them.

## Acceptance Criteria

- During execution, the active node changes in real time.
- Completed nodes retain their update payloads.
- Final state is shown separately from incremental node updates.

---

## 한국어

# 03 그래프 실행 타임라인

## 코딩 범위

- 그래프: `graphs/03_graph_execution_timeline.py`는 `01_simple_graph` 및 `07_streaming`의 스트리밍 동작을 채택합니다.
- 프런트엔드: `src/examples/03-graph-execution-timeline/`는 노드 상태 카드와 상태 패널을 렌더링합니다.

## 구현 계획

1. 결정적 노드 이름과 가시적 상태 업데이트를 사용하여 작은 다중 노드 그래프를 정의합니다.
2. `updates`를 스트리밍하고 각 업데이트를 `pending`, `running`, `done`, `error` 또는 `skipped`에 매핑합니다.
3. 현재 노드 강조를 사용하여 수평 또는 수직 타임라인을 렌더링합니다.
4. 비교를 위해 노드별 업데이트 옆에 최종 상태를 표시합니다.

## SDK 및 상태 참고 사항

UI는 최종 출력에서 진행 상황을 추론하는 대신 스트림 이벤트를 사용해야 합니다. 노드 이름으로 키가 지정된 정규화된 이벤트 저장소를 유지합니다.

## 위험

- 스트림 이벤트는 빠르게 도착하거나 예상한 시각적 순서와 다르게 도착할 수 있습니다. 이벤트 감속기는 멱등원이어야 합니다.
- 건너뛴 노드는 런타임이 이를 내보내지 않는 경우 명시적인 그래프 메타데이터가 필요할 수 있습니다.

## 승인 기준

- 실행 중에 활성 노드가 실시간으로 변경됩니다.
- 완료된 노드는 업데이트 페이로드를 유지합니다.
- 최종 상태는 증분 노드 업데이트와 별도로 표시됩니다.


## EXAMPLES-LAYERS-06: 03-graph-execution-timeline

- `GraphExecutionTimelineExample.tsx`: screen composition and DOM event binding.
- `useGraphExecutionTimeline.ts`: SDK requests, stream callbacks, and derived view values.
- `useGraphExecutionTimelineState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useGraphExecutionTimeline`는 SDK 요청·스트림·파생값을 관리한다. `useGraphExecutionTimelineState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
