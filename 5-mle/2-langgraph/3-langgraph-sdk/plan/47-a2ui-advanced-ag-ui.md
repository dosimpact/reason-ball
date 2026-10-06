# 47 A2UI Advanced AG-UI

## Coding Scope

- Graph: `graphs/47_a2ui_advanced_ag_ui.py` implements dynamic A2UI with progress events and frontend action handlers.
- Frontend: `src/examples/47-a2ui-advanced-ag-ui/` renders dynamic UI, custom progress, and action callbacks.
- Runtime: reuse the shared CopilotKit runtime, AG-UI renderer, and frontend action registration patterns.

## Implementation Plan

1. Add an `47_a2ui_advanced` graph that emits dynamic schema updates plus explicit progress events.
2. Support frontend actions such as selecting an option, applying a filter, or confirming a generated result.
3. Render a custom progress component for backend phases like planning, fetching, composing, and waiting for action.
4. Wire frontend action handlers back into the agent flow without replacing the backend as source of truth.
5. Show action results in both the generated UI panel and the chat transcript.
6. Register graph, runtime agent, example metadata, and route as example 47.

## SDK And State Notes

The backend owns generated UI schema and progress state. Frontend action handlers send user intent back to the graph/runtime and should not mutate authoritative A2UI state without backend confirmation.

## Risks

- Combining dynamic schema, progress streaming, and action handlers creates ordering issues.
- Action handler names and payloads must stay stable for resumable flows.
- Renderer validation is required because malformed dynamic UI could otherwise break the whole example.

## Acceptance Criteria

- The A2UI Advanced AG-UI example appears as example 47 in the navigation.
- The UI shows custom progress while dynamic A2UI is generated.
- At least one frontend action handler sends a user selection back to the agent.
- The generated UI updates after the action is handled.
- Malformed schema or action errors render visibly without crashing the app.

---

## 한국어

# 47 A2UI 고급 AG-UI

## 코딩 범위

- 그래프: `graphs/47_a2ui_advanced_ag_ui.py`는 진행 이벤트 및 프런트엔드 작업 핸들러를 사용하여 동적 A2UI를 구현합니다.
- 프런트엔드: `src/examples/47-a2ui-advanced-ag-ui/`는 동적 UI, 사용자 정의 진행 및 작업 콜백을 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임, AG-UI 렌더러 및 프런트엔드 작업 등록 패턴을 재사용합니다.

## 구현 계획

1. 동적 스키마 업데이트와 명시적 진행 이벤트를 내보내는 `47_a2ui_advanced` 그래프를 추가합니다.
2. 옵션 선택, 필터 적용, 생성된 결과 확인 등의 프런트엔드 작업을 지원합니다.
3. 계획, 가져오기, 작성 및 작업 대기와 같은 백엔드 단계에 대한 사용자 정의 진행 구성 요소를 렌더링합니다.
4. 백엔드를 진실 소스로 교체하지 않고 프런트엔드 작업 핸들러를 에이전트 흐름에 다시 연결합니다.
5. 생성된 UI 패널과 채팅 내용 모두에 작업 결과를 표시합니다.
6. 예제 47과 같이 그래프, 런타임 에이전트, 예제 메타데이터 및 경로를 등록합니다.

## SDK 및 상태 참고 사항

백엔드는 생성된 UI 스키마와 진행 상태를 소유합니다. 프런트엔드 작업 핸들러는 사용자 의도를 그래프/런타임으로 다시 보내며 백엔드 확인 없이 신뢰할 수 있는 A2UI 상태를 변경해서는 안 됩니다.

## 위험

- 동적 스키마, 진행 스트리밍 및 작업 처리기를 결합하면 순서 문제가 발생합니다.
- 재개 가능한 흐름을 위해 작업 핸들러 이름과 페이로드가 안정적으로 유지되어야 합니다.
- 잘못된 형식의 동적 UI가 전체 예제를 손상시킬 수 있으므로 렌더러 유효성 검사가 필요합니다.

## 승인 기준

- A2UI Advanced AG-UI 예제는 탐색에서 예제 47로 나타납니다.
- 동적 A2UI가 생성되는 동안 UI에 사용자 정의 진행 상황이 표시됩니다.
- 하나 이상의 프런트엔드 작업 핸들러가 사용자 선택을 에이전트에 다시 보냅니다.
- 작업이 처리된 후 생성된 UI가 업데이트됩니다.
- 잘못된 스키마 또는 작업 오류가 앱 충돌 없이 시각적으로 렌더링됩니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `A2uiAdvancedAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `A2uiAdvancedAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `useA2uiAdvancedAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
