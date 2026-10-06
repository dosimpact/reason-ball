# 36 Backend Tool Rendering AG-UI

## Coding Scope

- Graph: `graphs/36_backend_tool_rendering_ag_ui.py` implements a Python LangGraph ReAct agent with backend tools whose execution is rendered in the frontend.
- Frontend: `src/examples/36-backend-tool-rendering-ag-ui/` renders a CopilotKit chat surface and custom backend tool result cards.
- Runtime: reuse the CopilotKit runtime and `/api/copilotkit` Vite proxy introduced for example 35.

## Implementation Plan

1. Add a `36_backend_tool_rendering` graph using `langgraph.prebuilt.create_react_agent`, `common.llm.create_llm()`, and a deterministic backend tool such as `get_weather` or `search_inventory`.
2. Make the backend tool return structured data with fields needed by the UI: title, status, summary, key metrics, and optional detail rows.
3. Register the graph in `langgraph.json` and the CopilotKit runtime graph list with agent name `36_backend_tool_rendering`.
4. Add a React example that wraps `CopilotChat` in `CopilotKit`, passes `agent="36_backend_tool_rendering"`, and registers a `useRenderTool` renderer for the backend tool.
5. Render tool lifecycle states separately from assistant text: pending/loading, completed structured result, empty result, and error.
6. Register the example in the app shell and metadata list as example 36.

## SDK And State Notes

Backend tool execution belongs to the Python graph. The frontend only renders the backend tool call/result payload and should not duplicate the tool as a frontend action. Normalize tool results that arrive as parsed objects or JSON strings.

## Risks

- CopilotKit renderer APIs may differ by package version, especially for backend tool rendering and streamed tool call updates.
- LangGraph tool messages can expose args/results in slightly different shapes depending on stream mode.
- Tool cards must be scoped to this example so CopilotKit CSS does not override existing app layout.

## Acceptance Criteria

- The Backend Tool Rendering AG-UI example appears as example 36 in the navigation.
- Asking for the supported backend tool action invokes the Python tool and renders a custom tool card.
- The UI shows a loading state before the final backend tool result.
- Tool args and final result are visible without requiring users to inspect raw JSON.
- A normal assistant response still renders when no backend tool is needed.

---

## 한국어

# 36 백엔드 도구 렌더링 AG-UI

## 코딩 범위

- 그래프: `graphs/36_backend_tool_rendering_ag_ui.py`는 실행이 프런트엔드에서 렌더링되는 백엔드 도구를 사용하여 Python LangGraph ReAct 에이전트를 구현합니다.
- 프런트엔드: `src/examples/36-backend-tool-rendering-ag-ui/`는 CopilotKit 채팅 화면과 사용자 정의 백엔드 도구 결과 카드를 렌더링합니다.
- 런타임: 예제 35에 도입된 CopilotKit 런타임 및 `/api/copilotkit` Vite 프록시를 재사용합니다.

## 구현 계획

1. `langgraph.prebuilt.create_react_agent`, `common.llm.create_llm()` 및 `get_weather` 또는 `search_inventory`와 같은 결정적 백엔드 도구를 사용하여 `36_backend_tool_rendering` 그래프를 추가합니다.
2. 백엔드 도구가 UI에 필요한 필드(제목, 상태, 요약, 주요 측정항목, 선택적 세부정보 행)가 포함된 구조화된 데이터를 반환하도록 만듭니다.
3. `langgraph.json`에 그래프를 등록하고 에이전트 이름 `36_backend_tool_rendering`로 CopilotKit 런타임 그래프 목록을 등록합니다.
4. `CopilotChat`를 `CopilotKit`로 래핑하고, `agent="36_backend_tool_rendering"`를 전달하고, 백엔드 도구용 `useRenderTool` 렌더러를 등록하는 React 예제를 추가합니다.
5. 어시스턴트 텍스트와 별도로 도구 수명 주기 상태(보류 중/로드 중, 완료된 구조화된 결과, 빈 결과 및 오류)를 렌더링합니다.
6. 예제 36과 같이 앱 셸 및 메타데이터 목록에 예제를 등록합니다.

## SDK 및 상태 참고 사항

백엔드 도구 실행은 Python 그래프에 속합니다. 프런트엔드는 백엔드 도구 호출/결과 페이로드만 렌더링하며 도구를 프런트엔드 작업으로 복제해서는 안 됩니다. 구문 분석된 개체 또는 JSON 문자열로 도착하는 도구 결과를 정규화합니다.

## 위험

- CopilotKit 렌더러 API는 특히 백엔드 도구 렌더링 및 스트리밍 도구 호출 업데이트의 경우 패키지 버전에 따라 다를 수 있습니다.
- LangGraph 도구 메시지는 스트림 모드에 따라 인수/결과를 약간 다른 모양으로 노출할 수 있습니다.
- CopilotKit CSS가 기존 앱 레이아웃을 재정의하지 않도록 도구 카드의 범위를 이 예제로 지정해야 합니다.

## 승인 기준

- 백엔드 도구 렌더링 AG-UI 예제는 탐색에서 예제 36으로 나타납니다.
- 지원되는 백엔드 도구 작업을 요청하면 Python 도구가 호출되고 사용자 지정 도구 카드가 렌더링됩니다.
- 최종 백엔드 도구 결과가 나오기 전에 UI에 로딩 상태가 표시됩니다.
- 사용자가 원시 JSON을 검사하지 않고도 도구 인수 및 최종 결과를 볼 수 있습니다.
- 백엔드 도구가 필요하지 않은 경우에도 일반 어시스턴트 응답이 계속 렌더링됩니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `BackendToolRenderingAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `BackendToolRenderingAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `styles.ts` | Local presentation styles / 로컬 표시 스타일 |
| `useBackendToolRenderingAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
