# 45 A2UI Fixed Schema AG-UI

## Coding Scope

- Graph: `graphs/45_a2ui_fixed_schema_ag_ui.py` implements a Python graph that returns a fixed-schema flight search UI payload.
- Frontend: `src/examples/45-a2ui-fixed-schema-ag-ui/` renders deterministic A2UI flight cards from that schema.
- Runtime: reuse the shared CopilotKit runtime and AG-UI rendering path.

## Implementation Plan

1. Add an `45_a2ui_fixed_schema` graph that parses a flight-search request into a fixed response shape.
2. Define the fixed UI payload with route, dates, travelers, filters, and a list of flight options.
3. Render the schema with React flight cards, filter chips, price/duration fields, and select buttons.
4. Keep this example non-streaming to demonstrate fixed-schema A2UI behavior.
5. Validate required fields before rendering and show a compact fallback if the payload is incomplete.
6. Register graph, runtime agent, example metadata, and route as example 45.

## SDK And State Notes

The fixed schema is a contract between the Python graph and React renderer. The frontend should not infer missing flight fields from prose.

## Risks

- The model may produce incomplete schema unless the backend constrains or post-processes output.
- Flight data should be fixture-based, not live booking data.
- A2UI renderer failure needs a safe fallback to avoid a blank chat surface.

## Acceptance Criteria

- The A2UI Fixed Schema AG-UI example appears as example 45 in the navigation.
- A flight-search prompt renders structured flight cards.
- The schema does not change between runs except for data values.
- Selecting a flight triggers a visible UI action state.
- Incomplete payloads show a fallback instead of crashing.

---

## 한국어

# 45 A2UI 고정 스키마 AG-UI

## 코딩 범위

- 그래프: `graphs/45_a2ui_fixed_schema_ag_ui.py`는 고정 스키마 항공편 검색 UI 페이로드를 반환하는 Python 그래프를 구현합니다.
- 프런트엔드: `src/examples/45-a2ui-fixed-schema-ag-ui/`는 해당 스키마에서 결정론적 A2UI 비행 카드를 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임 및 AG-UI 렌더링 경로를 재사용합니다.

## 구현 계획

1. 항공편 검색 요청을 고정된 응답 형태로 구문 분석하는 `45_a2ui_fixed_schema` 그래프를 추가합니다.
2. 경로, 날짜, 여행자, 필터 및 항공편 옵션 목록을 사용하여 고정 UI 페이로드를 정의합니다.
3. React 비행 카드, 필터 칩, 가격/기간 필드 및 선택 버튼을 사용하여 스키마를 렌더링합니다.
4. 고정 스키마 A2UI 동작을 보여주기 위해 이 예제를 비스트리밍으로 유지합니다.
5. 렌더링하기 전에 필수 필드의 유효성을 검사하고 페이로드가 불완전한 경우 압축 대체를 표시합니다.
6. 예제 45와 같이 그래프, 런타임 에이전트, 예제 메타데이터 및 경로를 등록합니다.

## SDK 및 상태 참고 사항

고정 스키마는 Python 그래프와 React 렌더러 간의 계약입니다. 프런트엔드는 자연어 텍스트에서 누락된 비행 필드를 추론해서는 안 됩니다.

## 위험

- 백엔드가 출력을 제한하거나 사후 처리하지 않는 한 모델은 불완전한 스키마를 생성할 수 있습니다.
- 항공편 데이터는 실시간 예약 데이터가 아닌 일정 기반이어야 합니다.
- A2UI 렌더러 오류는 빈 채팅 화면을 피하기 위해 안전한 대체가 필요합니다.

## 승인 기준

- A2UI 고정 스키마 AG-UI 예제는 탐색에서 예제 45로 나타납니다.
- 항공편 검색 프롬프트는 구조화된 항공편 카드를 렌더링합니다.
- 스키마는 데이터 값을 제외하고 실행 간에 변경되지 않습니다.
- 항공편을 선택하면 눈에 보이는 UI 작업 상태가 트리거됩니다.
- 불완전한 페이로드는 충돌 대신 폴백을 표시합니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `A2uiFixedSchemaAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `A2uiFixedSchemaAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `useA2uiFixedSchemaAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
