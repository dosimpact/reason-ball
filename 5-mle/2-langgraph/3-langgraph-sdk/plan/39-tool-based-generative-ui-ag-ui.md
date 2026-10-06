# 39 Tool Based Generative UI AG-UI

## Coding Scope

- Graph: `graphs/39_tool_based_generative_ui_ag_ui.py` implements a Python agent with a tool that returns a UI payload for a haiku-style generator.
- Frontend: `src/examples/39-tool-based-generative-ui-ag-ui/` renders the tool payload as a custom generative UI component.
- Runtime: reuse the CopilotKit runtime and backend tool rendering path.

## Implementation Plan

1. Add a `39_tool_based_generative_ui` graph using `create_react_agent` and a backend tool such as `generate_haiku_card`.
2. Make the tool return structured UI data: topic, haiku lines, mood, palette, and optional explanation.
3. Register a React `useRenderTool` renderer that maps the backend tool result into a polished haiku card.
4. Provide suggested prompts that reliably call the backend tool.
5. Show raw fallback information only when the structured renderer cannot parse the result.
6. Register graph, runtime agent, example metadata, and route as example 39.

## SDK And State Notes

The UI payload is produced by a backend tool result, not by frontend-only state. The renderer should accept both object and JSON-string tool results to match LangGraph/CopilotKit transport variations.

## Risks

- The model may answer directly instead of calling the tool unless the system prompt strongly routes haiku generation through the tool.
- Tool result rendering can break if optional visual fields are omitted.
- The example overlaps with backend tool rendering, so acceptance should focus on generated UI output rather than generic tool cards.

## Acceptance Criteria

- The Tool Based Generative UI AG-UI example appears as example 39 in the navigation.
- A haiku prompt calls the backend generative UI tool.
- The frontend renders a custom haiku card with all generated lines.
- The assistant can explain or summarize the generated card after the tool result.
- Invalid or incomplete tool payloads show a graceful fallback.

---

## 한국어

# 39 도구 기반 생성 UI AG-UI

## 코딩 범위

- 그래프: `graphs/39_tool_based_generative_ui_ag_ui.py`는 하이쿠 스타일 생성기에 대한 UI 페이로드를 반환하는 도구를 사용하여 Python 에이전트를 구현합니다.
- 프런트엔드: `src/examples/39-tool-based-generative-ui-ag-ui/`는 도구 페이로드를 사용자 정의 생성 UI 구성 요소로 렌더링합니다.
- 런타임: CopilotKit 런타임 및 백엔드 도구 렌더링 경로를 재사용합니다.

## 구현 계획

1. `create_react_agent` 및 `generate_haiku_card`와 같은 백엔드 도구를 사용하여 `39_tool_based_generative_ui` 그래프를 추가합니다.
2. 도구가 구조화된 UI 데이터(주제, 하이쿠 대사, 분위기, 팔레트 및 선택적 설명)를 반환하도록 만듭니다.
3. 백엔드 도구 결과를 세련된 하이쿠 카드에 매핑하는 React `useRenderTool` 렌더러를 등록합니다.
4. 백엔드 도구를 안정적으로 호출하는 제안된 프롬프트를 제공합니다.
5. 구조적 렌더러가 결과를 구문 분석할 수 없는 경우에만 원시 대체 정보를 표시합니다.
6. 예제 39와 같이 그래프, 런타임 에이전트, 예제 메타데이터 및 경로를 등록합니다.

## SDK 및 상태 참고 사항

UI 페이로드는 프런트엔드 전용 상태가 아닌 백엔드 도구 결과에 의해 생성됩니다. 렌더러는 LangGraph/CopilotKit 전송 변형과 일치하도록 객체와 JSON 문자열 도구 결과를 모두 수용해야 합니다.

## 위험

- 시스템 프롬프트가 도구를 통해 하이쿠 생성을 강력하게 라우팅하지 않는 한 모델은 도구를 호출하는 대신 직접 응답할 수 있습니다.
- 선택적 시각적 필드가 생략되면 도구 결과 렌더링이 중단될 수 있습니다.
- 예제는 백엔드 도구 렌더링과 겹치므로 일반 도구 카드보다는 생성된 UI 출력에 초점을 맞춰 수용해야 합니다.

## 승인 기준

- 도구 기반 생성 UI AG-UI 예제는 탐색에서 예제 39로 나타납니다.
- 하이쿠 프롬프트는 백엔드 생성 UI 도구를 호출합니다.
- 프런트엔드는 생성된 모든 라인이 포함된 맞춤형 하이쿠 카드를 렌더링합니다.
- 어시스턴트는 도구 결과 후 생성된 카드를 설명하거나 요약할 수 있습니다.
- 유효하지 않거나 불완전한 도구 페이로드는 우아한 대체를 표시합니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `ToolBasedGenerativeUiAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `ToolBasedGenerativeUiAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `styles.ts` | Local presentation styles / 로컬 표시 스타일 |
| `useToolBasedGenerativeUiAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
