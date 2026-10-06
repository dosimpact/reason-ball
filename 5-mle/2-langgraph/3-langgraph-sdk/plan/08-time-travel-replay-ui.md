# 08 Time Travel Replay UI

## Coding Scope

- Graph: `graphs/08_time_travel_replay.py` extends the checkpoint graph from example 07.
- Frontend: `src/examples/08-time-travel-replay-ui/` supports replay and fork workflows.

## Implementation Plan

1. Reuse checkpoint history primitives from example 07.
2. Add controls to select a checkpoint and start a replay from that state.
3. Support forked input or config overrides for comparison.
4. Render original run and fork run side by side.

## SDK And State Notes

Use the SDK APIs for state history and checkpoint-based run configuration. Preserve original thread/run references.

## Risks

- Replay semantics are easy to confuse with normal rerun; label original, replay, and fork clearly.
- Forked runs must not overwrite the original thread state without explicit intent.

## Acceptance Criteria

- A user can choose a previous checkpoint and start another run from it.
- Fork output is distinguishable from original output.
- The UI shows which checkpoint produced each replay.

---

## 한국어

#08 시간여행 리플레이 UI

## 코딩 범위

- 그래프: `graphs/08_time_travel_replay.py`는 예제 07의 체크포인트 그래프를 확장합니다.
- 프런트엔드: `src/examples/08-time-travel-replay-ui/`는 재생 및 포크 워크플로를 지원합니다.

## 구현 계획

1. 예제 07의 체크포인트 기록 기본 요소를 재사용합니다.
2. 체크포인트를 선택하고 해당 상태에서 재생을 시작하는 컨트롤을 추가합니다.
3. 비교를 위해 분기된 입력 또는 구성 재정의를 지원합니다.
4. 원본 실행과 포크 실행을 나란히 렌더링합니다.

## SDK 및 상태 참고 사항

상태 기록 및 체크포인트 기반 실행 구성을 위해 SDK API를 사용하세요. 원래 스레드/실행 참조를 유지합니다.

## 위험

- 재생 의미론은 일반 재실행과 혼동되기 쉽습니다. 원본, 재생, 포크 라벨을 명확하게 지정하세요.
- 분기 실행은 명시적인 의도 없이 원래 스레드 상태를 덮어쓰면 안 됩니다.

## 승인 기준

- 사용자는 이전 체크포인트를 선택하고 여기에서 다른 실행을 시작할 수 있습니다.
- Fork 출력은 Original 출력과 구별됩니다.
- UI는 각 리플레이를 생성한 체크포인트를 보여줍니다.


## EXAMPLES-LAYERS-06: 08-time-travel-replay-ui

- `TimeTravelReplayExample.tsx`: screen composition and DOM event binding.
- `useTimeTravelReplay.ts`: SDK requests, stream callbacks, and derived view values.
- `useTimeTravelReplayState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useTimeTravelReplay`는 SDK 요청·스트림·파생값을 관리한다. `useTimeTravelReplayState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
