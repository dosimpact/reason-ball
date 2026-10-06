# 20 Observability UI

## Coding Scope

- Graph: `graphs/20_observability.py` adapts `20_history_reducer` and observability examples.
- Frontend: `src/examples/20-observability-ui/` renders metrics and trace links.

## Implementation Plan

1. Capture node timing, token usage where available, cost estimates, and run metadata.
2. Add a metrics panel with totals and per-node rows.
3. Render LangSmith trace links when environment config provides them.
4. Keep raw metadata available for debugging.

## SDK And State Notes

Use run metadata, stream timing, and provider usage metadata. Treat missing token data as unknown, not zero.

## Risks

- Token and cost metadata can be unavailable depending on provider response.
- LangSmith links require optional environment configuration.

## Acceptance Criteria

- Completed runs show latency and node elapsed time.
- Token/cost fields handle missing data safely.
- LangSmith links appear only when available.

---

## 한국어

# 20 관찰성 UI

## 코딩 범위

- 그래프: `graphs/20_observability.py`는 `20_history_reducer` 및 관찰 가능성 예제를 적용합니다.
- 프런트엔드: `src/examples/20-observability-ui/`는 메트릭과 추적 링크를 렌더링합니다.

## 구현 계획

1. 노드 타이밍, 가능한 경우 토큰 사용량, 비용 추정 및 실행 메타데이터를 캡처합니다.
2. 합계 및 노드별 행이 포함된 측정항목 패널을 추가합니다.
3. 환경 구성이 제공하는 경우 LangSmith 추적 링크를 렌더링합니다.
4. 디버깅에 사용할 수 있는 원시 메타데이터를 유지합니다.

## SDK 및 상태 참고 사항

실행 메타데이터, 스트림 타이밍 및 공급자 사용 메타데이터를 사용합니다. 누락된 토큰 데이터를 0이 아닌 알 수 없는 것으로 처리합니다.

## 위험

- 공급자의 응답에 따라 토큰 및 비용 메타데이터를 사용하지 못할 수 있습니다.
- LangSmith 링크에는 선택적 환경 구성이 필요합니다.

## 승인 기준

- 완료된 실행에는 대기 시간과 노드 경과 시간이 표시됩니다.
- 토큰/비용 필드는 누락된 데이터를 안전하게 처리합니다.
- LangSmith 링크는 사용 가능한 경우에만 나타납니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `ObservabilityExample.tsx`: screen composition.
- `useObservability.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useObservabilityState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed RunMetricsPanel, NodeTimingsPanel, TokenUsagePanel, CostEstimatePanel, TraceLinksPanel, RunMetadataPanel, ObservabilityEventsPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `ObservabilityExample.tsx`: 화면 조합.
- `useObservability.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useObservabilityState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
