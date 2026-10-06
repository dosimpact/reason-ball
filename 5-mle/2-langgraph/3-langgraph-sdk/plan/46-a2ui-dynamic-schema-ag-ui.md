# 46 A2UI Dynamic Schema AG-UI

## Coding Scope

- Graph: `graphs/46_a2ui_dynamic_schema_ag_ui.py` implements a Python graph that generates dynamic A2UI surfaces from conversation context.
- Frontend: `src/examples/46-a2ui-dynamic-schema-ag-ui/` renders schema-driven UI components with streaming updates.
- Runtime: reuse the shared CopilotKit runtime and AG-UI renderer plumbing.

## Implementation Plan

1. Add an `46_a2ui_dynamic_schema` graph that decides which UI schema to emit based on the user's request.
2. Support a small approved component set such as form, list, comparison cards, and summary panel.
3. Stream schema/data updates so the frontend can render partial UI while the agent continues.
4. Add a React schema renderer that validates component type and required props before rendering.
5. Render unsupported schema nodes as a safe fallback with a clear warning.
6. Register graph, runtime agent, example metadata, and route as example 46.

## SDK And State Notes

Dynamic schema does not mean arbitrary React execution. The frontend renders only whitelisted component types and sanitized props emitted by the backend.

## Risks

- Overly flexible schemas can create unsafe or untestable render paths.
- Streaming schema updates may arrive before all required data is present.
- Model output must be constrained enough for deterministic E2E tests.

## Acceptance Criteria

- The A2UI Dynamic Schema AG-UI example appears as example 46 in the navigation.
- Different prompt types produce different whitelisted UI surfaces.
- Streaming updates visibly refine the generated UI.
- Unsupported or malformed schema nodes render a fallback.
- The final assistant response references the generated UI state.

---

## 한국어

# 46 A2UI 동적 스키마 AG-UI

## 코딩 범위

- 그래프: `graphs/46_a2ui_dynamic_schema_ag_ui.py`는 대화 컨텍스트에서 동적 A2UI 표면을 생성하는 Python 그래프를 구현합니다.
- 프런트엔드: `src/examples/46-a2ui-dynamic-schema-ag-ui/`는 스트리밍 업데이트를 통해 스키마 기반 UI 구성 요소를 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임 및 AG-UI 렌더러 배관을 재사용합니다.

## 구현 계획

1. 사용자의 요청에 따라 내보낼 UI 스키마를 결정하는 `46_a2ui_dynamic_schema` 그래프를 추가합니다.
2. 양식, 목록, 비교 카드 및 요약 패널과 같은 소규모 승인 구성 요소 세트를 지원합니다.
3. 에이전트가 계속되는 동안 프런트엔드가 부분 UI를 렌더링할 수 있도록 스키마/데이터 업데이트를 스트리밍합니다.
4. 렌더링하기 전에 구성 요소 유형과 필수 소품의 유효성을 검사하는 React 스키마 렌더러를 추가합니다.
5. 명확한 경고와 함께 지원되지 않는 스키마 노드를 안전한 대체 노드로 렌더링합니다.
6. 예제 46과 같이 그래프, 런타임 에이전트, 예제 메타데이터 및 경로를 등록합니다.

## SDK 및 상태 참고 사항

동적 스키마는 임의의 React 실행을 의미하지 않습니다. 프런트엔드는 화이트리스트에 포함된 구성 요소 유형과 백엔드에서 내보낸 삭제된 소품만 렌더링합니다.

## 위험

- 지나치게 유연한 스키마는 안전하지 않거나 테스트할 수 없는 렌더링 경로를 생성할 수 있습니다.
- 필요한 모든 데이터가 존재하기 전에 스트리밍 스키마 업데이트가 도착할 수 있습니다.
- 모델 출력은 결정론적 E2E 테스트를 위해 충분히 제한되어야 합니다.

## 승인 기준

- A2UI 동적 스키마 AG-UI 예제는 탐색에서 예제 46으로 나타납니다.
- 다양한 프롬프트 유형은 서로 다른 화이트리스트 UI 표면을 생성합니다.
- 스트리밍 업데이트는 생성된 UI를 시각적으로 개선합니다.
- 지원되지 않거나 잘못된 스키마 노드가 대체를 렌더링합니다.
- 최종 어시스턴트 응답은 생성된 UI 상태를 참조합니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `A2uiDynamicSchemaAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `A2uiDynamicSchemaAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `useA2uiDynamicSchemaAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
