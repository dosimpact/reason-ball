# 04 Streaming UI

## Coding Scope

- Graph: `graphs/04_streaming_ui.py` adapts `07_streaming` and `18_custom_streaming`.
- Frontend: `src/examples/04-streaming-ui/` compares stream modes in a single view.

## Implementation Plan

1. Build a graph that can emit message tokens, state updates, final values, and custom progress events.
2. Add a segmented control for `messages`, `updates`, `values`, and `custom`.
3. Render mode-specific panels without hiding the raw event log.
4. Keep the same prompt runnable across modes for side-by-side learning.

## SDK And State Notes

Use the LangGraph SDK stream mode option and keep mode-specific parsers isolated. Do not treat every stream payload as chat text.

## Risks

- Different stream modes expose different payload shapes, so shared parsing must not erase mode-specific data.
- Token streaming can finish before React renders intermediate states unless updates are buffered carefully.

## Acceptance Criteria

- A user can run the same input in each stream mode.
- Token output, state updates, values, and custom events appear in distinct UI regions.
- Unknown event shapes are retained in a raw debug panel.

---

## 한국어

# 04 스트리밍 UI

## 코딩 범위

- 그래프: `graphs/04_streaming_ui.py`는 `07_streaming` 및 `18_custom_streaming`를 적용합니다.
- 프런트엔드: `src/examples/04-streaming-ui/`는 단일 보기에서 스트림 모드를 비교합니다.

## 구현 계획

1. 메시지 토큰, 상태 업데이트, 최종 값 및 사용자 정의 진행 이벤트를 생성할 수 있는 그래프를 구축합니다.
2. `messages`, `updates`, `values` 및 `custom`에 대한 분할된 컨트롤을 추가합니다.
3. 원시 이벤트 로그를 숨기지 않고 모드별 패널을 렌더링합니다.
4. 병렬 학습을 위해 여러 모드에서 동일한 프롬프트를 실행할 수 있도록 유지합니다.

## SDK 및 상태 참고 사항

LangGraph SDK 스트림 모드 옵션을 사용하고 모드별 파서를 격리된 상태로 유지하세요. 모든 스트림 페이로드를 채팅 텍스트로 취급하지 마세요.

## 위험

- 다양한 스트림 모드는 다양한 페이로드 형태를 노출하므로 공유 구문 분석은 모드별 데이터를 삭제해서는 안 됩니다.
- 업데이트가 신중하게 버퍼링되지 않는 한 React가 중간 상태를 렌더링하기 전에 토큰 스트리밍이 완료될 수 있습니다.

## 승인 기준

- 사용자는 각 스트림 모드에서 동일한 입력을 실행할 수 있습니다.
- 토큰 출력, 상태 업데이트, 값 및 사용자 정의 이벤트가 별도의 UI 영역에 표시됩니다.
- 알 수 없는 이벤트 형태가 원시 디버그 패널에 유지됩니다.


## EXAMPLES-LAYERS-06: 04-2-streaming-react-hook

- `StreamingReactHookExample.tsx`: screen composition and DOM event binding.
- `useStreamingReactHook.ts`: SDK requests, stream callbacks, and derived view values.
- `useStreamingReactHookState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useStreamingReactHook`는 SDK 요청·스트림·파생값을 관리한다. `useStreamingReactHookState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.


## EXAMPLES-LAYERS-06: 04-streaming-ui

- `StreamingUiExample.tsx`: screen composition and DOM event binding.
- `useStreamingUi.ts`: SDK requests, stream callbacks, and derived view values.
- `useStreamingUiState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useStreamingUi`는 SDK 요청·스트림·파생값을 관리한다. `useStreamingUiState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
