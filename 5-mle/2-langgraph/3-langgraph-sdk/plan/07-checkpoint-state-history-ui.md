# 07 Checkpoint State History UI

## Coding Scope

- Graph: `graphs/07_checkpoint_state_history.py` adapts `06_checkpointer`.
- Frontend: `src/examples/07-checkpoint-state-history-ui/` displays current state and checkpoint history.

## Implementation Plan

1. Build a checkpointed graph with multiple visible state mutations.
2. Add state fetch helpers and checkpoint listing helpers.
3. Render current state, checkpoint list, selected checkpoint detail, and a state diff.
4. Link each checkpoint to the run and node update that produced it when available.

## SDK And State Notes

Use LangGraph thread state and history APIs. Normalize checkpoint ids and timestamps for UI display.

## Risks

- Checkpoint ordering may differ from display expectations; sort by runtime timestamp when available.
- Large state payloads need compact rendering to keep the UI usable.

## Acceptance Criteria

- After a run, multiple checkpoints are visible.
- Selecting a checkpoint shows the state at that moment.
- The UI can compare selected checkpoint state with current state.

---

## 한국어

#07 체크포인트 상태 기록 UI

## 코딩 범위

- 그래프: `graphs/07_checkpoint_state_history.py`는 `06_checkpointer`를 적용합니다.
- 프런트엔드: `src/examples/07-checkpoint-state-history-ui/`는 현재 상태와 체크포인트 기록을 표시합니다.

## 구현 계획

1. 여러 개의 가시적 상태 변이가 있는 체크포인트 그래프를 구축합니다.
2. 상태 가져오기 도우미 및 체크포인트 목록 도우미를 추가합니다.
3. 현재 상태, 체크포인트 목록, 선택한 체크포인트 세부정보 및 상태 차이를 렌더링합니다.
4. 각 체크포인트를 실행 및 생성한 노드 업데이트(사용 가능한 경우)에 연결합니다.

## SDK 및 상태 참고 사항

LangGraph 스레드 상태 및 기록 API를 사용합니다. UI 표시를 위해 체크포인트 ID와 타임스탬프를 정규화합니다.

## 위험

- 체크포인트 순서는 디스플레이 예상과 다를 수 있습니다. 가능한 경우 런타임 타임스탬프를 기준으로 정렬합니다.
- 큰 상태 페이로드에는 UI를 계속 사용할 수 있도록 컴팩트한 렌더링이 필요합니다.

## 승인 기준

- 실행 후 여러 체크포인트가 표시됩니다.
- 체크포인트를 선택하면 그 순간의 상태를 보여줍니다.
- UI는 선택된 체크포인트 상태를 현재 상태와 비교할 수 있습니다.


## EXAMPLES-LAYERS-06: 07-checkpoint-state-history-ui

- `CheckpointStateHistoryExample.tsx`: screen composition and DOM event binding.
- `useCheckpointStateHistory.ts`: SDK requests, stream callbacks, and derived view values.
- `useCheckpointStateHistoryState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useCheckpointStateHistory`는 SDK 요청·스트림·파생값을 관리한다. `useCheckpointStateHistoryState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
