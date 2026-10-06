# 11 Parallel Map-Reduce UI

## Coding Scope

- Graph: `graphs/11_parallel_map_reduce.py` adapts `08_map_reduce` and `14_parallel_branches`.
- Frontend: `src/examples/11-parallel-map-reduce-ui/` shows fan-out worker progress and reducer output.

## Implementation Plan

1. Create a fan-out graph that processes several items independently.
2. Emit worker start, success, failure, and result updates.
3. Render worker cards ordered by item while completion events arrive asynchronously.
4. Show reducer input list and final combined result.

## SDK And State Notes

Use custom or update events with stable worker ids. Partial failure should remain inspectable.

## Risks

- Parallel events may complete in nondeterministic order; rendering must key by worker id.
- Partial failures should not block display of successful worker results.

## Acceptance Criteria

- Worker progress is visible independently.
- Results accumulate as workers finish.
- Reducer output is shown separately from individual worker outputs.

---

## 한국어

# 11 병렬 맵 축소 UI

## 코딩 범위

- 그래프: `graphs/11_parallel_map_reduce.py`는 `08_map_reduce` 및 `14_parallel_branches`를 적용합니다.
- 프런트엔드: `src/examples/11-parallel-map-reduce-ui/`는 팬아웃 작업자 진행 상황과 리듀서 출력을 보여줍니다.

## 구현 계획

1. 여러 항목을 독립적으로 처리하는 팬아웃 그래프를 만듭니다.
2. 작업자 시작, 성공, 실패 및 결과 업데이트를 내보냅니다.
3. 완료 이벤트가 비동기적으로 도착하는 동안 항목별로 정렬된 작업자 카드를 렌더링합니다.
4. 감속기 입력 목록과 최종 결합 결과를 표시합니다.

## SDK 및 상태 참고 사항

안정적인 작업자 ID로 맞춤 이벤트 또는 업데이트 이벤트를 사용하세요. 부분적인 실패는 검사 가능한 상태로 유지되어야 합니다.

## 위험

- 병렬 이벤트는 비결정적 순서로 완료될 수 있습니다. 렌더링은 작업자 ID로 키를 입력해야 합니다.
- 부분적인 실패로 인해 성공적인 작업자 결과 표시가 차단되어서는 안 됩니다.

## 승인 기준

- 작업자 진행 상황이 독립적으로 표시됩니다.
- 작업자가 완료하면 결과가 누적됩니다.
- 감속기 출력은 개별 작업자 출력과 별도로 표시됩니다.


## EXAMPLES-LAYERS-06: 11-parallel-map-reduce-ui

- `ParallelMapReduceExample.tsx`: screen composition and DOM event binding.
- `useParallelMapReduce.ts`: SDK requests, stream callbacks, and derived view values.
- `useParallelMapReduceState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useParallelMapReduce`는 SDK 요청·스트림·파생값을 관리한다. `useParallelMapReduceState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
