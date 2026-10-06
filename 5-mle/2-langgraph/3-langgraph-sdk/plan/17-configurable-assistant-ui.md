# 17 Configurable Assistant UI

## Coding Scope

- Graph: `graphs/17_configurable_assistant.py` adapts `17_configurable`.
- Frontend: `src/examples/17-configurable-assistant-ui/` lets users adjust assistant/run config.

## Implementation Plan

1. Define configurable fields for model alias, system prompt, style, and temperature.
2. Build a config form with validation and reset.
3. Run the same prompt with default config and override config.
4. Display config used for each run alongside output.

## SDK And State Notes

Use SDK config fields supported by LangGraph runtime. Persist form values locally unless assistant-level persistence is added.

## Risks

- Unsupported config keys may be silently ignored by the graph.
- Model aliases must stay aligned with `.env.example` and local `.env`.

## Acceptance Criteria

- Changing config affects the next run without changing code.
- The UI shows the effective config per run.
- Invalid config values are blocked before run creation.

---

## 한국어

# 17 구성 가능한 어시스턴트 UI

## 코딩 범위

- 그래프: `graphs/17_configurable_assistant.py`는 `17_configurable`를 적용합니다.
- 프런트엔드: `src/examples/17-configurable-assistant-ui/`를 사용하면 사용자가 보조/실행 구성을 조정할 수 있습니다.

## 구현 계획

1. 모델 별칭, 시스템 프롬프트, 스타일 및 온도에 대한 구성 가능한 필드를 정의합니다.
2. 유효성 검사 및 재설정을 통해 구성 양식을 작성합니다.
3. 기본 구성으로 동일한 프롬프트를 실행하고 구성을 재정의합니다.
4. 출력과 함께 각 실행에 사용되는 구성을 표시합니다.

## SDK 및 상태 참고 사항

LangGraph 런타임에서 지원하는 SDK 구성 필드를 사용하세요. 어시스턴트 수준 지속성이 추가되지 않는 한 양식 값을 로컬로 유지합니다.

## 위험

- 지원되지 않는 구성 키는 그래프에서 자동으로 무시될 수 있습니다.
- 모델 별칭은 `.env.example` 및 로컬 `.env`와 일치해야 합니다.

## 승인 기준

- 구성을 변경하면 코드를 변경하지 않고도 다음 실행에 영향을 줍니다.
- UI는 실행당 효과적인 구성을 보여줍니다.
- 잘못된 구성 값은 실행 생성 전에 차단됩니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `ConfigurableAssistantExample.tsx`: screen composition.
- `useConfigurableAssistant.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useConfigurableAssistantState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed RunStatusPanel, EffectiveConfigPanel, OutputComparisonPanel, ConfigDiffPanel, ConfigEventsPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `ConfigurableAssistantExample.tsx`: 화면 조합.
- `useConfigurableAssistant.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useConfigurableAssistantState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
