# 21 Intent Feedback Generative UI

## Coding Scope

- Graph: `graphs/21_intent_feedback_generative_ui.py` handles stock price intent validation and UI request payloads.
- Frontend: `src/examples/21-intent-feedback-generative-ui/` renders generated selector components.

## Implementation Plan

1. Parse user input for ticker, market, and period.
2. If fields are missing or ambiguous, emit a UI payload for ticker list, market selector, or period selector.
3. Convert user selections into a new HumanMessage or structured resume payload.
4. Run the completed request and show the resulting answer.

## SDK And State Notes

Represent UI requests as structured state or custom events. Keep generated UI payloads typed and whitelisted.

## Risks

- Generated UI payloads must be schema-checked before rendering.
- Stock ticker examples need mocked or clearly scoped data if no market API is configured.

## Acceptance Criteria

- Ambiguous input produces UI controls instead of only text.
- User selections resume or continue the graph with structured values.
- Completed intent is visible before the final answer.

---

## 한국어

# 21 인텐트 피드백 생성 UI

## 코딩 범위

- 그래프: `graphs/21_intent_feedback_generative_ui.py`는 주가 의도 검증 및 UI 요청 페이로드를 처리합니다.
- 프런트엔드: `src/examples/21-intent-feedback-generative-ui/`는 생성된 선택기 구성 요소를 렌더링합니다.

## 구현 계획

1. 종목, 시장, 기간에 대한 사용자 입력을 구문 분석합니다.
2. 필드가 누락되거나 모호한 경우 티커 목록, 시장 선택기 또는 기간 선택기에 대한 UI 페이로드를 내보냅니다.
3. 사용자 선택을 새로운 HumanMessage 또는 구조화된 이력서 페이로드로 변환합니다.
4. 완료된 요청을 실행하고 결과 응답을 표시합니다.

## SDK 및 상태 참고 사항

UI 요청을 구조화된 상태 또는 맞춤 이벤트로 표현합니다. 생성된 UI 페이로드를 입력하고 화이트리스트에 추가하세요.

## 위험

- 생성된 UI 페이로드는 렌더링하기 전에 스키마 검사를 받아야 합니다.
- 시장 API가 구성되지 않은 경우 주식 시세 표시기 예시에는 모의 데이터 또는 명확한 범위의 데이터가 필요합니다.

## 승인 기준

- 모호한 입력으로 인해 텍스트만 생성되는 대신 UI 컨트롤이 생성됩니다.
- 사용자 선택은 구조화된 값으로 그래프를 재개하거나 계속합니다.
- 완성된 의도는 최종 답변 전에 표시됩니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `IntentFeedbackGenerativeExample.tsx`: screen composition.
- `useIntentFeedbackGenerative.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useIntentFeedbackGenerativeState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed IntentStatusPanel, GeneratedUIRequestPanel, CompletedIntentPanel, QuoteSnapshotPanel, IntentEventsPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `IntentFeedbackGenerativeExample.tsx`: 화면 조합.
- `useIntentFeedbackGenerative.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useIntentFeedbackGenerativeState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
