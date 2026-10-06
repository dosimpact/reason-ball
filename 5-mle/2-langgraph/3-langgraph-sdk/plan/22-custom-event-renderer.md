# 22 Custom Event Renderer

## Coding Scope

- Graph: `graphs/22_custom_event_renderer.py` adapts `18_custom_streaming`.
- Frontend: `src/examples/22-custom-event-renderer/` renders inline progress events.

## Implementation Plan

1. Emit custom events for phase, progress, warning, and status.
2. Create typed renderers for known event kinds.
3. Place progress components inline in the chat flow.
4. Preserve unknown custom events in a raw inspector.

## SDK And State Notes

Use `custom` stream mode and avoid overloading assistant text messages for progress.

## Risks

- Custom event names need versioning to avoid renderer drift.
- Rapid progress updates can cause noisy rendering without coalescing.

## Acceptance Criteria

- Custom events are visually distinct from assistant messages.
- Progress updates replace or update the right inline component.
- Unknown event kinds remain inspectable.

---

## 한국어

# 22 커스텀 이벤트 렌더러

## 코딩 범위

- 그래프: `graphs/22_custom_event_renderer.py`는 `18_custom_streaming`를 적용합니다.
- 프런트엔드: `src/examples/22-custom-event-renderer/`는 인라인 진행 이벤트를 렌더링합니다.

## 구현 계획

1. 단계, 진행률, 경고 및 상태에 대한 사용자 정의 이벤트를 내보냅니다.
2. 알려진 이벤트 종류에 대한 형식화된 렌더러를 만듭니다.
3. 채팅 흐름에 진행 구성 요소를 인라인으로 배치합니다.
4. 원시 검사기에서 알려지지 않은 사용자 정의 이벤트를 보존합니다.

## SDK 및 상태 참고 사항

`custom` 스트림 모드를 사용하고 진행을 위한 보조 문자 메시지의 과부하를 피하세요.

## 위험

- 렌더러 드리프트를 방지하려면 사용자 정의 이벤트 이름에 버전 관리가 필요합니다.
- 진행 상황이 빠르게 업데이트되면 병합 없이 렌더링 시 노이즈가 발생할 수 있습니다.

## 승인 기준

- 사용자 정의 이벤트는 보조 메시지와 시각적으로 구별됩니다.
- 진행 상황 업데이트는 올바른 인라인 구성 요소를 대체하거나 업데이트합니다.
- 알 수 없는 이벤트 종류는 계속 검사 가능합니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `CustomEventRendererExample.tsx`: screen composition.
- `useCustomEventRenderer.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useCustomEventRendererState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed RendererStatusPanel, InlineEventRendererPanel, PhaseProgressPanel, WarningEventsPanel, UnknownEventInspectorPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `CustomEventRendererExample.tsx`: 화면 조합.
- `useCustomEventRenderer.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useCustomEventRendererState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
