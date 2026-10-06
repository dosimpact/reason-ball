# 18 Retry Error Degradation UI

## Coding Scope

- Graph: `graphs/18_retry_error_degradation.py` adapts `19_retry_policy` and graceful degradation patterns.
- Frontend: `src/examples/18-retry-error-degradation-ui/` exposes retry and fallback behavior.

## Implementation Plan

1. Create a graph path that can intentionally fail before succeeding or falling back.
2. Emit retry attempt, backoff, error, fallback, and final status updates.
3. Render a retry timeline and final result panel.
4. Include controls for normal, flaky, and forced-failure modes.

## SDK And State Notes

Keep errors structured with node, attempt, message, recoverable flag, and fallback result.

## Risks

- Random failures make tests flaky; include deterministic failure modes.
- Retry errors should be educational, not hidden behind final fallback success.

## Acceptance Criteria

- Retry attempts are counted and visible.
- Final failure is distinguishable from fallback success.
- Users can reproduce the error path deterministically.

---

## 한국어

#18 재시도 오류 저하 UI

## 코딩 범위

- 그래프: `graphs/18_retry_error_degradation.py`는 `19_retry_policy` 및 우아한 성능 저하 패턴을 적용합니다.
- 프런트엔드: `src/examples/18-retry-error-degradation-ui/`는 재시도 및 대체 동작을 노출합니다.

## 구현 계획

1. 성공하거나 후퇴하기 전에 의도적으로 실패할 수 있는 그래프 경로를 만듭니다.
2. 재시도, 백오프, 오류, 대체 및 최종 상태 업데이트를 내보냅니다.
3. 재시도 타임라인과 최종 결과 패널을 렌더링합니다.
4. 정상, 불안정 및 강제 오류 모드에 대한 제어를 포함합니다.

## SDK 및 상태 참고 사항

노드, 시도, 메시지, 복구 가능 플래그 및 대체 결과로 오류 구조를 유지합니다.

## 위험

- 무작위 실패로 인해 테스트가 불안정해집니다. 결정론적 실패 모드를 포함합니다.
- 재시도 오류는 교육적이어야 하며 최종 대체 성공 뒤에 숨겨서는 안 됩니다.

## 승인 기준

- 재시도 시도가 계산되어 표시됩니다.
- 최종 실패는 대체 성공과 구별됩니다.
- 사용자는 오류 경로를 결정적으로 재현할 수 있습니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `RetryErrorDegradationExample.tsx`: screen composition.
- `useRetryErrorDegradation.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useRetryErrorDegradationState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed RunStatusPanel, RetryTimelinePanel, ErrorDetailsPanel, FallbackResultPanel, RetryEventsPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `RetryErrorDegradationExample.tsx`: 화면 조합.
- `useRetryErrorDegradation.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useRetryErrorDegradationState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
