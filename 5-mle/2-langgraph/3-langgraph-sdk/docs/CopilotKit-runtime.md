# CopilotKit Runtime Playbook

## 1. CopilotKit runtime 개념

### 1.1 CopilotKit runtime은 무엇인가?

목적 : CopilotKit 기반 UI와 LangGraph agent server 사이에서 chat 요청, agent context, frontend tool, render tool, thread 정보를 중계하는 backend runtime의 역할을 이해한다.

상세 로직

1. 기본 역할
  - CopilotKit runtime은 브라우저의 `CopilotKit` / `CopilotChat` 컴포넌트가 직접 LangGraph API를 호출하지 않도록 중간에서 요청을 받는다.
  - frontend가 등록한 tool schema, agent context, message, thread 정보를 runtime이 agent 실행 요청으로 변환한다.
  - agent가 streaming event, tool call, tool result, assistant message를 내보내면 runtime이 CopilotKit UI가 이해하는 형태로 다시 전달한다.
  - 즉 runtime은 LLM 자체가 아니라, UI와 agent 사이의 protocol bridge다.

2. 왜 기존 LangGraph SDK client만으로 충분하지 않은가?
  - 1-34번 예제는 `React UI -> @langchain/langgraph-sdk -> Python LangGraph dev server` 구조로 충분하다.
  - 35-47번은 `CopilotKit`, `CopilotChat`, `useFrontendTool`, `useRenderTool`, `useAgentContext` 같은 CopilotKit 계층을 사용한다.
  - 이 기능들은 CopilotKit runtime이 agent protocol로 묶어 주는 것이 핵심이다.
  - 따라서 LangGraph server는 Python 방식으로 유지하되, frontend와 LangGraph 사이에 runtime을 하나 더 둔다.

3. 이 프로젝트에서의 흐름
  - 1-34번 예제 흐름:
    - `React UI -> @langchain/langgraph-sdk -> Python LangGraph dev server`
  - 35-47번 CopilotKit AG-UI 예제 흐름:
    - `React UI -> /api/copilotkit -> CopilotKit runtime -> Python LangGraph dev server -> OpenAI`
  - 즉 CopilotKit 예제도 `langgraph.json`의 Python graph를 사용하지만, 호출 경로만 CopilotKit runtime을 거친다.

## 2. 주요 구성 요소

### 2.1 React UI

목적 : CopilotKit runtime에 연결되는 frontend surface와 browser-side tool을 구성한다.

상세 로직

1. `CopilotKit`
  - React tree를 CopilotKit runtime과 연결하는 provider다.
  - `runtimeUrl="/api/copilotkit"`처럼 runtime endpoint를 지정한다.
  - `agent="agentic_chat"`처럼 기본 agent id를 지정한다.

2. `CopilotChat`
  - CopilotKit이 제공하는 chat UI다.
  - 사용자의 message 입력, assistant response rendering, streaming 상태 표시를 처리한다.
  - 일반 LangGraph SDK 예제의 custom chat UI와 달리 CopilotKit protocol에 맞춰 동작한다.

3. `useAgentContext`
  - 브라우저가 알고 있는 context를 agent에 전달한다.
  - 예제에서는 `Name of the user = Bob` 같은 값을 runtime을 통해 agent 실행 context에 포함한다.

4. `useFrontendTool`
  - 브라우저에서만 실행 가능한 tool을 agent에게 노출한다.
  - 예제의 `change_background`는 agent가 호출하지만 실제 실행은 React state update다.
  - tool parameter는 `zod` schema로 정의하고, handler는 브라우저에서 실행된다.

5. `useRenderTool`
  - tool call/result를 React component로 렌더링한다.
  - 예제의 `get_weather`는 Python backend tool result가 object 또는 JSON string으로 와도 같은 weather card로 표시한다.
  - backend tool result shape가 integration마다 다를 수 있으므로 renderer에서 normalization을 둔다.
  - 36-47번처럼 backend tool rendering, generative UI, shared state, A2UI schema renderer를 붙일 때도 tool result shape를 renderer 경계에서 정규화한다.

### 2.2 CopilotKit runtime

목적 : frontend와 LangGraph agent server 사이의 CopilotKit protocol endpoint를 제공한다.

상세 로직

1. Runtime endpoint
  - frontend는 `/api/copilotkit`으로 요청한다.
  - Vite dev server는 `/api/copilotkit`을 runtime service인 `http://localhost:2932`로 proxy한다.
  - runtime은 `CopilotRuntime`과 `createCopilotRuntimeHandler`로 구성한다.

2. Agent registry
  - runtime은 `agents` registry를 가진다.
  - 이 프로젝트에서는 35-47번 CopilotKit 예제 각각을 `LangGraphAgent`로 등록한다.
  - frontend의 `agent`, runtime registry key, `LangGraphAgent.graphId`, `langgraph.json` graph key가 모두 일치해야 한다.
  - 예를 들어 36번은 `agent="backend_tool_rendering"`, runtime key `backend_tool_rendering`, `graphId: "backend_tool_rendering"`, `langgraph.json` key `backend_tool_rendering`을 같이 사용한다.

3. LangGraph 연결
  - runtime의 `LangGraphAgent`는 `deploymentUrl`과 `graphId`를 가진다.
  - `deploymentUrl`은 CopilotKit runtime URL이 아니라 실제 LangGraph server URL이다.
  - 이 프로젝트에서는 Python LangGraph dev server가 `http://localhost:2931`이고, `graphId`는 아래 35-47번 등록 id 중 하나다.
  - URL은 `LANGGRAPH_URL`로 override할 수 있다.

4. 35-47번 등록 id
  - `agentic_chat`
  - `backend_tool_rendering`
  - `human_in_the_loop_ag_ui`
  - `agentic_generative_ui`
  - `tool_based_generative_ui`
  - `shared_state_agent_ui`
  - `predictive_state_updates`
  - `agentic_chat_reasoning`
  - `agentic_chat_multimodal`
  - `subgraphs_ag_ui`
  - `a2ui_fixed_schema`
  - `a2ui_dynamic_schema`
  - `a2ui_advanced`
  - 숫자 prefix를 graph id에 넣지 않는다. `36_backend_tool_rendering`처럼 frontend id를 만들면 LangGraph server가 registered graph로 찾지 못한다.

### 2.3 Python LangGraph agent

목적 : 기존 프로젝트 프로세스와 같은 Python graph server에서 CopilotKit용 Python graph를 실행한다.

상세 로직

1. Graph 등록
  - 35-47번 graph는 `graphs/{number}_{topic}_ag_ui.py`에 둔다.
  - graph는 Python LangGraph 방식으로 작성하고, 필요한 예제에서는 `langchain.agents.create_agent`와 `CopilotKitMiddleware`를 사용한다.
  - `langgraph.json`에는 runtime graph id와 같은 key로 등록한다.
  - 따라서 `uv run langgraph dev --host 0.0.0.0 --port 2931` 명령으로 1-47번 graph를 함께 실행한다.

2. Backend tool
  - Python graph는 예제별 backend tool을 제공한다.
  - 35번의 `get_weather`처럼 backend tool result를 UI 카드로 보여줄 때 frontend는 `useRenderTool({ name })`로 같은 tool name을 렌더링한다.
  - 36-47번은 inventory, approval, generated workspace, schema card 등 예제별 tool 이름과 result schema를 맞춘다.

3. Frontend tool
  - `change_background`처럼 브라우저에서만 실행되는 UI state update는 backend Python tool로 만들지 않는다.
  - frontend approval, shared state patch, predictive state reconciliation처럼 browser state를 직접 바꾸는 동작은 `useFrontendTool`에 둔다.
  - `CopilotKitMiddleware`가 frontend tool schema를 model 호출에 주입하고, tool call을 CopilotKit runtime/UI 쪽으로 연결한다.

## 3. 실행 흐름

### 3.1 35-47번 CopilotKit AG-UI 실행

목적 : CopilotKit AG-UI 예제를 로컬 또는 live host에서 실행하기 위해 필요한 server들을 올바른 순서로 띄운다.

상세 로직

1. Python LangGraph server 실행
  - 1-47번 graph를 같은 `langgraph.json`에서 실행한다.
  - 기본 포트는 `2931`이다.

```bash
uv run langgraph dev --host 0.0.0.0 --port 2931
```

2. CopilotKit runtime 실행
  - React UI의 `/api/copilotkit` 요청을 받아 Python LangGraph server로 넘긴다.
  - 기본 포트는 `2932`다.

```bash
pnpm --filter langgraph-sdk-examples runtime:copilotkit
```

3. React UI 실행
  - Vite app을 실행한다.
  - `/api/copilotkit`은 Vite proxy를 통해 `http://localhost:2932`로 전달된다.

```bash
pnpm --filter langgraph-sdk-examples dev
```

4. 접속
  - 브라우저에서 예제 35 `Agentic Chat AG-UI`를 선택한다.
  - 외부 접속 환경에서는 `http://dodonet.iptime.org:2805/`처럼 Vite가 노출된 URL을 사용한다.

5. live 검증
  - live host 검증은 Vite URL을 `E2E_BASE_URL`로 넘긴다.

```bash
E2E_BASE_URL=http://dodonet.iptime.org:2805 pnpm exec playwright test e2e/35-47-ag-ui-dojo-live.spec.ts --project=chromium --workers=1 --reporter=list
```

  - 이 테스트는 `/api/copilotkit/info`에 모든 agent가 노출되는지 확인하고, 각 AG-UI 예제마다 실제 `agent/run` POST가 200으로 끝나는지 검증한다.
  - live 화면 스크린샷은 `test-results/live-screenshots/`에 예제 slug별 PNG로 남긴다.

## 4. 흔한 오류와 원인

### 4.1 `In-mem server for JS graphs is not supported`

목적 : Python LangGraph CLI가 JS graph를 읽을 때 발생하는 오류를 빠르게 판별한다.

상세 로직

1. 원인
  - `langgraph.json`에 `.ts` 또는 `.js` graph entry가 들어 있다.
  - Python `uv run langgraph dev`가 JS graph를 감지하고 실행을 중단한다.

2. 해결
  - 이 프로젝트의 35-47번은 Python graph 방식으로 작성하므로 `langgraph.json`에는 `.py` graph만 둔다.
  - 별도 `langgraph.agentic-chat.json`과 JS graph server는 사용하지 않는다.
  - `uv run langgraph dev --host 0.0.0.0 --port 2931`로 실행한다.

### 4.2 CopilotChat이 응답하지 않음

목적 : UI는 뜨지만 chat request가 실패하는 상황을 점검한다.

상세 로직

1. Runtime 확인
  - `http://localhost:2932/api/copilotkit/info`가 응답해야 한다.
  - Vite proxy 환경에서는 `http://localhost:2805/api/copilotkit/info`도 응답해야 한다.

2. Python LangGraph server 확인
  - `http://localhost:2931/info`가 응답해야 한다.
  - `langgraph.json`에 실행하려는 CopilotKit graph key가 등록되어 있어야 한다.

3. Agent id 확인
  - frontend의 `agent`, runtime의 `agents.{id}`, `LangGraphAgent.graphId`, LangGraph graph id가 모두 일치해야 한다.

4. Env 확인
  - OpenAI model 호출에는 `OPENAI_API_KEY`가 필요하다.
  - runtime이 Python LangGraph server를 찾는 URL은 `LANGGRAPH_URL`로 override할 수 있다.

### 4.3 `/api/copilotkit` 404

목적 : 브라우저 Network 탭에서 `POST /api/copilotkit`이 404로 보일 때 runtime 또는 proxy 문제를 빠르게 분리한다.

상세 로직

1. 원인
  - Vite dev server만 떠 있고 CopilotKit runtime service가 떠 있지 않다.
  - Vite proxy가 `/api/copilotkit`을 `http://localhost:2932`로 넘기지 못한다.
  - runtime은 떠 있지만 요청 path가 `basePath = "/api/copilotkit"`와 다르다.

2. 해결
  - `pnpm --filter langgraph-sdk-examples runtime:copilotkit`을 별도 프로세스로 실행한다.
  - `http://localhost:2932/api/copilotkit/info`와 `http://dodonet.iptime.org:2805/api/copilotkit/info`를 둘 다 확인한다.
  - live host에서는 frontend가 직접 `2932`를 호출하지 않고, 항상 Vite proxy의 `/api/copilotkit`을 호출해야 한다.

### 4.4 `Invalid assistant` 또는 422

목적 : CopilotKit runtime은 응답하지만 LangGraph server가 assistant id를 거부하는 상황을 판별한다.

상세 로직

1. 원인
  - frontend `agent` 또는 runtime `graphId`가 `langgraph.json`의 graph key와 다르다.
  - 예를 들어 `31_chat_plan_board`, `36_backend_tool_rendering`처럼 숫자 prefix가 붙은 id를 보내면 registered graph 목록에 없어서 422가 난다.
  - LangGraph dev server를 재시작하지 않아 새 graph 등록이 반영되지 않았다.

2. 해결
  - frontend `agent`, runtime registry key, `LangGraphAgent.graphId`, `langgraph.json` graph key를 같은 문자열로 맞춘다.
  - 숫자 prefix는 파일명과 route slug에만 사용하고 graph id에는 넣지 않는다.
  - `uv run langgraph dev --host 0.0.0.0 --port 2931`을 재시작한 뒤 `/info` registered graph 목록을 확인한다.

## 5. 핵심 정리

### 5.1 언제 CopilotKit runtime이 필요한가?

목적 : LangGraph SDK 직접 호출 방식과 CopilotKit runtime 방식의 선택 기준을 구분한다.

상세 로직

1. Runtime이 필요 없는 경우
  - frontend가 `@langchain/langgraph-sdk`로 직접 `client.runs.stream(...)`을 호출한다.
  - UI가 직접 stream event를 파싱하고 직접 렌더링한다.
  - frontend tool injection이나 CopilotKit chat protocol이 필요 없다.

2. Runtime이 필요한 경우
  - `CopilotKit`, `CopilotChat`을 사용한다.
  - `useFrontendTool`, `useRenderTool`, `useAgentContext`를 agent 실행과 연결한다.
  - AG-UI protocol 기반 event, tool call, shared context를 사용한다.

3. 이 프로젝트의 결론
  - 1-34번은 LangGraph SDK 학습 예제라 runtime 없이 동작한다.
  - 35-47번은 Python LangGraph graph를 사용하지만 UI protocol이 CopilotKit이므로 runtime이 필요하다.
  - 따라서 LangGraph server는 기존 Python 프로세스를 따르고, CopilotKit runtime만 별도 Node 프로세스로 둔다.
