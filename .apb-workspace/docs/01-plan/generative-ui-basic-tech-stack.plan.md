# generative-ui-basic-tech-stack Plan

## Goal

기본 LangGraph 개발 환경을 구축한다.  

## Details  

### 대상 프로젝트  

frontend: › '/Users/studio/workspace/projects/reason-ball/20-portfolio/1-reason-hwang/1-fe-host/package.json'
LangGraph server: › '/Users/studio/workspace/projects/reason-ball/20-portfolio/1-reason-hwang/3-langgraph-fast/package.json'  

### LangGraph 디렉터리 구조

```txt
20-portfolio/1-reason-hwang/3-langgraph-fast/
├── package.json
├── pyproject.toml
├── uv.lock
├── langgraph.json
├── .env.example
├── Dockerfile.langgraph
├── docker-compose.yml
├── src/
│   ├── graph/
│   │   ├── main_graph/
│   │   │   └── ... existing files unchanged
│   │   ├── subgraph/
│   │   │   ├── starter_graph/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── state.py
│   │   │   │   ├── workflow.py
│   │   │   │   ├── node/
│   │   │   │   │   └── __init__.py
│   │   │   │   ├── tools/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── weather.py
│   │   │   │   └── prompts/
│   │   │   │       └── __init__.py
│   │   │   └── tenk/
│   │   │       └── ... existing files unchanged
│   │   └── shared/
│   │       └── provider/
│   │           └── chatgpt_oauth_proxy.py
│   └── server/
│       └── server.py
└── tests/
    └── graph/
        └── subgraph/
            └── starter_graph/
                ├── test_starter_workflow.py
                └── test_weather_tool.py
```

### LangGraph server 기본 그래프 만들기  

goal: 기본 형태의 prebuilt React agent를 구현한다.  
지시사항
- tool은 무료 날씨 API를 하나 연동해서 날씨 정보를 알려주는 기능을 하나 구현한다.  
- 노드 구조: start > React agent > end로 간단하게 끝낸다.  
- LLM invoke 방법은 › '/Users/studio/workspace/projects/reason-ball/20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/package.json'의 Codex proxy server가 endpoint가 된다.  
- 이미 'chatgpt_oauth_proxy.py'에 구현되어 있으니 문제 없다.  
- “messages를 가진 StateGraph”가 될 것이다.
- LangGraph Studio에서 테스트해 볼 수 있게 진행한다.
- 개발 서버 테스트는 dev 0.0.0.0 host에 올라가도록 설정한다.  

### LangGraph API dev server를 빌드해서 온프레미스로   

goal: Docker로 빌드해서 서버는 runs, threads, assistants 같은 API endpoint를 제공하고, 실행 가능한 tasks를 package.json에 script로 작성하기
지시사항
- Dockerfile로 만들고 Docker Compose로 관리할 예정이다.
- package.json 스크립트에 docker build > docker compose up > docker compose down 3가지로 테스트해 볼 예정이다.
- env에는 port 등이 들어간다.  


### Frontend LangGraph chat UI 진행하기 및 LangGraph SDK 설치하기  

goal: frontend에서 가장 기본적인 형태의 chat UI를 구현한다.  
지시사항  
- LangGraph Standard API를 사용해서 endpoint를 구현한다.  
- LangGraph JS SDK를 반드시 써야 한다.   
- layer를 여러 단계로 나누어서 진행한다. 예를 들어 api - state - React context - presentation layer 등
- 특히 LangGraph `useStream` 훅을 사용하지 않고, 직접 LangGraph SDK를 최대한 사용하되 LangGraph SDK endpoint를 직접 사용한다.  


#### Frontend layer detail

목표는 `useStream` 훅 없이 `@langchain/langgraph-sdk`의 `Client`를 직접 감싼 얇은 계층을 만들고, UI는 LangGraph SDK의 세부 구현을 몰라도 동작하게 만드는 것이다. 구현 순서는 `api -> domain/state -> react context -> presentation` 순서로 진행한다.

##### 1. Env / config layer

- 역할: LangGraph API endpoint, assistant/graph id, 기본 stream mode 같은 외부 설정을 한 곳에서 읽는다.
- 예상 파일:
  - `src/shared/config/langgraph.ts`
- 책임:
  - `VITE_LANGGRAPH_API_URL` 또는 프로젝트에서 사용하는 env prefix를 통해 API base URL을 제공한다.
  - 기본 assistant id는 `starter_graph` 또는 `langgraph.json`에 등록된 graph id와 맞춘다.
  - presentation layer에서 env 값을 직접 읽지 않게 한다.

##### 2. API client layer

- 역할: LangGraph Standard API와 직접 통신하는 유일한 계층이다.
- 예상 파일:
  - `src/features/chat/api/langgraphClient.ts`
  - `src/features/chat/api/chatRunApi.ts`
- 책임:
  - `new Client({ apiUrl })` 생성을 캡슐화한다.
  - thread 생성, 기존 thread 조회, run stream 시작을 함수 단위로 제공한다.
  - React 컴포넌트가 `client.threads.create`, `client.runs.stream` 같은 SDK 메서드를 직접 호출하지 않게 한다.
- 주요 함수 초안:
  - `createChatThread(): Promise<string>`
  - `streamChatRun(params): AsyncIterable<LangGraphStreamEvent>`
  - `getThreadState(threadId): Promise<unknown>`
- stream 방식:
  - 사용자가 메시지를 보내면 `threadId`를 확보한다.
  - `client.runs.stream(threadId, assistantId, { input, streamMode })` 형태로 streaming run을 시작한다.
  - SDK event를 그대로 UI에 넘기지 않고 다음 layer에서 쓰기 쉬운 내부 event로 normalize한다.

##### 3. Domain adapter layer

- 역할: LangGraph event와 app 내부 chat model 사이의 변환을 담당한다.
- 예상 파일:
  - `src/features/chat/model/chatTypes.ts`
  - `src/features/chat/model/langgraphEventAdapter.ts`
- 책임:
  - LangGraph message/state chunk를 UI가 쓰는 `ChatMessage` 형태로 변환한다.
  - stream event의 종류를 `message_delta`, `message_complete`, `metadata`, `error` 같은 내부 타입으로 정리한다.
  - tool call, interrupt, graph state update가 추가되더라도 presentation layer 변경을 최소화한다.
- 내부 타입 초안:
  - `ChatMessage`: `id`, `role`, `content`, `createdAt`, `status`
  - `ChatThread`: `threadId`, `messages`, `status`, `error`
  - `ChatStatus`: `idle | creating_thread | streaming | error`
  - `ChatStreamEvent`: SDK event를 normalize한 app 전용 event

##### 4. State layer

- 역할: chat 화면의 상태 전이를 순수 함수 중심으로 관리한다.
  - `src/features/chat/state/.ts`
- 책임:
  - 사용자 메시지 추가, assistant placeholder 생성, token append, run 완료, error 처리 상태 전이를 담당한다.
  - streaming 중 중복 submit을 막을 수 있게 `status`를 명확히 관리한다.
  - reducer는 SDK나 React context에 의존하지 않는다.
- 주요 action:
  - `threadCreated`
  - `userMessageSubmitted`
  - `assistantMessageStarted`
  - `assistantMessageDeltaReceived`
  - `assistantMessageCompleted`
  - `streamFailed`
  - `threadReset`

##### 5. React context / orchestration layer

- 역할: API client, adapter, reducer를 연결해서 화면에서 사용할 command를 제공한다.
- 예상 파일:
  - `src/features/chat/context/ChatProvider.tsx`
  - `src/features/chat/context/useChat.ts`
- 책임:
  - 최초 submit 시 thread가 없으면 thread를 생성한다.
  - `sendMessage(content)` command 안에서 사용자 메시지 dispatch, stream run 시작, event loop 처리, 완료/실패 처리를 수행한다.
  - `AbortController` 또는 동등한 취소 메커니즘을 연결해 streaming 중단을 지원할 수 있게 한다.
  - presentation layer에는 `messages`, `status`, `error`, `sendMessage`, `resetThread`만 노출한다.

##### 6. Presentation layer

- 역할: 채팅 UI를 렌더링하고 사용자 입력을 context command로 전달한다.
- 예상 파일:
  - `src/features/chat/ui/ChatPage.tsx`
  - `src/features/chat/ui/ChatMessageList.tsx`
  - `src/features/chat/ui/ChatComposer.tsx`
  - `src/features/chat/ui/ChatStatusBar.tsx`
- 책임:
  - SDK event, thread id 생성 방식, stream mode를 알지 않는다.
  - `status === "streaming"`이면 submit 버튼 비활성화 또는 stop 버튼 노출을 처리한다.
  - error message와 retry/reset UX를 제공한다.
  - 가장 기본 형태에서는 text-only chat으로 시작하고, 이후 tool call이나 generative UI payload는 별도 renderer로 확장한다.
- shadcn chat components 적용 지침:
  - `https://ui.shadcn.com/docs/changelog/2026-06-chat-components`의 `MessageScroller`, `Message`, `Bubble`, `Attachment`, `Marker`를 기준으로 구성한다.
  - 설치 명령은 `pnpm dlx shadcn@latest add message-scroller message bubble attachment marker`를 사용한다.
  - `ChatMessageList`는 `MessageScroller`를 사용해서 streaming reply, auto-follow, saved thread restore, visibility tracking 같은 conversation scroll 동작을 맡긴다.
  - 각 채팅 row는 `Message`로 배치하고 실제 말풍선 표면은 `Bubble`로 렌더링한다.
  - 파일/이미지 payload가 생기면 `Attachment`로 표현하고, streaming/tool/date/system 상태는 `Marker`로 표현한다.
  - `scroll-fade`는 conversation scroller나 attachment row에 적용하고, `shimmer`는 `Thinking...`, `Generating response...` 같은 live status에 사용한다.
  - shadcn 컴포넌트는 presentation concern만 담당하며 LangGraph SDK 호출, thread/run lifecycle, stream event normalize 로직은 포함하지 않는다.

##### 7. API boundary rule

- React 컴포넌트에서 직접 import 가능한 것은 `useChat`과 presentation component로 제한한다.
- LangGraph SDK import는 `api` layer에만 둔다.
- SDK event shape는 `domain adapter` 밖으로 새지 않게 한다.
- thread/run lifecycle은 `ChatProvider`에서만 조율한다.
- 상태 변경은 reducer action으로만 수행한다.

##### 8. Minimal flow

```txt
User input
  -> ChatComposer.submit
  -> useChat().sendMessage
  -> ChatProvider dispatch(userMessageSubmitted)
  -> chatRunApi.createChatThread, if needed
  -> chatRunApi.streamChatRun
  -> langgraphEventAdapter.toChatStreamEvent
  -> chatReducer append/update assistant message
  -> ChatMessageList render
```

##### 9. Validation focus

- env가 비어 있으면 명확한 에러를 보여준다.
- 첫 메시지 전송 시 thread가 1회 생성된다.
- 두 번째 메시지는 같은 thread로 이어진다.
- streaming chunk가 assistant message 하나에 누적된다.
- API 오류 발생 시 사용자 메시지는 유지되고 assistant placeholder는 error 상태가 된다.
- presentation component에는 `@langchain/langgraph-sdk` import가 없어야 한다.

## Verification

- Implementation scope:
- Public interfaces:
- External dependencies:
- Internal dependencies:
- Risky areas:

## Validation

- Core behavior works as designed.

### E2E 시나리오

- Given the feature is available, When the primary workflow is executed, Then the expected result is visible and persistent.

## Skills

### Gradate 단계

- TBD

### Validate 단계

- Browser-level E2E 검증 전에 아래 2개 서버가 선행 실행되어야 한다.
- LangGraph Studio/API server:
  - 대상 package: `/Users/studio/workspace/projects/reason-ball/20-portfolio/1-reason-hwang/3-langgraph-fast/package.json`
  - 실행 예시: `OPENAI_MODEL=gpt-5.4-mini pnpm run studio`
  - 프론트의 `NEXT_PUBLIC_LANGGRAPH_API_URL`은 Studio 로그의 `🚀 API` URL과 일치해야 한다. 예: `http://127.0.0.1:2024`
- Codex OAuth proxy server:
  - 대상 package: `/Users/studio/workspace/projects/reason-ball/20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/package.json`
  - 실행 예시: `pnpm run dev`
  - LangGraph server의 `OPENAI_BASE_URL`은 proxy endpoint와 일치해야 한다. 예: `http://127.0.0.1:18741/v1`
- 두 서버 중 하나라도 내려가 있으면 Validate 실행 전에 재기동한 뒤 browser-level E2E를 진행한다.
