# 35 Agentic Chat AG-UI

## Coding Scope

- Graph: `graphs/35_agentic_chat_ag_ui.py` implements a Python LangChain/LangGraph agent with CopilotKit AG-UI middleware.
- Frontend: `src/examples/35-agentic-chat-ag-ui/` renders a CopilotKit chat surface with frontend tools, render tools, user context, and suggestions.
- Runtime: add a standalone CopilotKit runtime service and Vite proxy for `/api/copilotkit` so the Vite app can connect to the LangGraph agent.

## Implementation Plan

1. Install required frontend/runtime packages with pnpm: `@copilotkit/react-core`, `@copilotkit/runtime`, and `zod`.
2. Add an `35_agentic_chat` Python graph using `langchain.agents.create_agent`, `CopilotKitMiddleware`, the shared OpenAI model factory, a backend `get_weather` tool, and system prompt `You are a helpful assistant.`
3. Register the Python graph in the main `langgraph.json` so it runs with the existing `uv run langgraph dev --host 0.0.0.0 --port 2931 --tunnel` process.
4. Add a React example that wraps `CopilotChat` in `CopilotKit`, passes `agent="35_agentic_chat"`, and points `runtimeUrl` at `/api/copilotkit`.
5. Register frontend behavior from the Dojo example: `useAgentContext` for user name `Bob`, `change_background` via `useFrontendTool`, `get_weather` via `useRenderTool`, and always-available suggestions for background changes and sonnet generation.
6. Register the example in the app shell, metadata list, LangGraph config, runtime service, and Vite proxy after the graph/runtime wiring is in place.

## SDK And State Notes

Keep CopilotKit-specific state local to this example. The background tool should update only the example container state, and the weather renderer should normalize tool results that arrive either as parsed objects or JSON-encoded strings. The Python graph uses CopilotKit middleware for frontend tool injection, while the weather capability belongs in the backend graph so `useRenderTool` can render the backend tool result.

## Risks

- CopilotKit v2 package versions and peer dependencies may drift; install through pnpm and verify the lockfile resolves cleanly.
- The current app is Vite-based, so the CopilotKit runtime route may require a separate dev-server adapter or documented proxy rather than a Next.js route.
- The CopilotKit runtime must point at `LANGGRAPH_URL` for the Python LangGraph server, not at the Vite app or the runtime itself.
- CSS from `@copilotkit/react-core/v2/styles.css` can conflict with the existing shell if the example is not scoped carefully.

## Acceptance Criteria

- The Agentic Chat AG-UI example appears as example 35 in the navigation.
- The Copilot chat renders and can complete a normal assistant response.
- Asking for a background change triggers the frontend tool and visibly updates `data-testid="background-container"`.
- Asking for weather renders a completed `data-testid="weather-info"` card with normalized fields.
- Suggested prompts are visible and usable.
- A second message in the same thread works without a missing checkpointer or resume error.

---

## 한국어

# 35 에이전트 채팅 AG-UI

## 코딩 범위

- 그래프: `graphs/35_agentic_chat_ag_ui.py`는 CopilotKit AG-UI 미들웨어를 사용하여 Python LangChain/LangGraph 에이전트를 구현합니다.
- 프런트엔드: `src/examples/35-agentic-chat-ag-ui/`는 프런트엔드 도구, 렌더링 도구, 사용자 컨텍스트 및 제안을 사용하여 CopilotKit 채팅 화면을 렌더링합니다.
- 런타임: Vite 앱이 LangGraph 에이전트에 연결할 수 있도록 독립형 CopilotKit 런타임 서비스와 `/api/copilotkit`용 Vite 프록시를 추가합니다.

## 구현 계획

1. pnpm을 사용하여 필수 프런트엔드/런타임 패키지(`@copilotkit/react-core`, `@copilotkit/runtime` 및 `zod`)를 설치합니다.
2. `langchain.agents.create_agent`, `CopilotKitMiddleware`, 공유 OpenAI 모델 팩토리, 백엔드 `get_weather` 도구 및 시스템 프롬프트 `You are a helpful assistant.`를 사용하여 `35_agentic_chat` Python 그래프를 추가합니다.
3. 기존 `uv run langgraph dev --host 0.0.0.0 --port 2931 --tunnel` 프로세스와 함께 실행되도록 기본 `langgraph.json`에 Python 그래프를 등록합니다.
4. `CopilotChat`를 `CopilotKit`로 래핑하고, `agent="35_agentic_chat"`를 전달하고, `/api/copilotkit`에서 `runtimeUrl`를 가리키는 React 예제를 추가합니다.
5. Dojo 예제의 프런트엔드 동작을 등록합니다. 사용자 이름 `Bob`에 대한 `useAgentContext`, `useFrontendTool`를 통한 `change_background`, `useRenderTool`를 통한 `get_weather`, 배경 변경 및 소네트 생성에 대해 항상 사용 가능한 제안.
6. 그래프/런타임 배선이 완료된 후 앱 셸, 메타데이터 목록, LangGraph 구성, 런타임 서비스 및 Vite 프록시에 예제를 등록합니다.

## SDK 및 상태 참고 사항

이 예에서는 CopilotKit 관련 상태를 로컬로 유지합니다. 백그라운드 도구는 예제 컨테이너 상태만 업데이트해야 하며 날씨 렌더러는 구문 분석된 개체 또는 JSON 인코딩 문자열로 도착하는 도구 결과를 정규화해야 합니다. Python 그래프는 프런트엔드 도구 주입을 위해 CopilotKit 미들웨어를 사용하는 반면 날씨 기능은 백엔드 그래프에 속하므로 `useRenderTool`는 백엔드 도구 결과를 렌더링할 수 있습니다.

## 위험

- CopilotKit v2 패키지 버전 및 피어 종속성이 드리프트될 수 있습니다. pnpm을 통해 설치하고 잠금 파일이 완전히 해결되는지 확인하세요.
- 현재 앱은 Vite 기반이므로 CopilotKit 런타임 경로에는 Next.js 경로가 아닌 별도의 개발 서버 어댑터 또는 문서화된 프록시가 필요할 수 있습니다.
- CopilotKit 런타임은 Vite 앱이나 런타임 자체가 아닌 Python LangGraph 서버의 `LANGGRAPH_URL`를 가리켜야 합니다.
- 예제의 범위를 주의 깊게 지정하지 않으면 `@copilotkit/react-core/v2/styles.css`의 CSS가 기존 셸과 충돌할 수 있습니다.

## 승인 기준

- Agentic Chat AG-UI 예시는 탐색에서 예시 35로 나타납니다.
- Copilot 채팅이 렌더링되고 일반적인 어시스턴트 응답을 완료할 수 있습니다.
- 배경 변경을 요청하면 프런트엔드 도구가 실행되고 `data-testid="background-container"`가 눈에 띄게 업데이트됩니다.
- 날씨를 요청하면 정규화된 필드가 포함된 완성된 `data-testid="weather-info"` 카드가 렌더링됩니다.
- 제안된 프롬프트가 표시되고 사용 가능합니다.
- 동일한 스레드의 두 번째 메시지는 체크포인터 누락이나 재개 오류 없이 작동합니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `AgenticChatAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `AgenticChatAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `useAgenticChatAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
