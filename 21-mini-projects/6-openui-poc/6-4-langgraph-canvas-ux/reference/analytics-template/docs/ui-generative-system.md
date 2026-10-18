# UI Generative System

Goal: LangGraph Python 기반으로 UI Generative Backend를 만들고, Tambo AI를 대신할 수 있는 `/study` 데모를 제공한다.

## Architecture

```text
/study Chat
  -> FastAPI SSE endpoint
  -> LangGraph workflow
  -> analytics tools2
  -> OpenAI structured output
  -> Graph / Markdown artifact
  -> Dashboard Canvas
```

핵심 경계는 다음과 같다.

- Tambo `/chat` route는 비교용으로 유지한다.
- `/study`는 Tambo provider 없이 LangGraph backend를 호출한다.
- 왼쪽 패널은 Chat이다.
- 오른쪽 패널은 기존 canvas/grid/renderer 시스템이다.
- Chat에서 생성된 artifact는 Add 버튼 또는 drag/drop으로 canvas에 들어간다.
- Canvas snapshot은 chat request에 포함되고, backend가 canvas patch를 반환하면 frontend가 검증 후 적용한다.

## Runtime

Python backend는 `uv` 패키지를 사용한다.

```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 2930
```

Next frontend는 2229~2999 범위의 포트를 사용한다.

```bash
pnpm exec next dev -H 0.0.0.0 -p 2929
```

Frontend는 기본적으로 same-origin Next rewrite proxy를 호출한다.

```text
/api/langgraph/chat/stream
```

Next proxy는 기본적으로 Python backend의 다음 URL로 요청을 전달한다.

```text
http://127.0.0.1:2930
```

필요하면 server-side `LANGGRAPH_API_URL` 또는 client-side direct call용 `NEXT_PUBLIC_LANGGRAPH_API_URL`로 변경한다.

## Environment

repo root의 `.env`를 backend가 직접 로드한다. 실제 key 값은 문서나 로그에 남기지 않는다.

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-nano
OPENAI_FALLBACK_MODEL=gpt-4.1-nano
CORS_ORIGINS=http://127.0.0.1:2929,http://localhost:2929,...
LANGGRAPH_API_URL=http://127.0.0.1:2930
```

OpenAI primary model 호출이 실패하면 fallback model로 재시도하고, 둘 다 실패하면 deterministic fallback artifact를 반환한다.

## API Contract

### `GET /health`

```json
{ "ok": true }
```

### `POST /api/chat/stream`

Request:

```ts
type ChatStreamRequest = {
  threadId?: string;
  message: string;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  canvas?: CanvasSnapshot;
};
```

Response는 SSE stream이다.

```text
event: tool_call
event: message_delta
event: artifact
event: canvas_patch
event: done
event: error
```

Artifact shape:

```ts
type StudyComponentArtifact =
  | {
      component: "Graph";
      props: StudyGraphProps;
    }
  | {
      component: "Markdown";
      props: MarkdownRendererProps;
    };
```

## Testing 계획

Backend API level testing:

```bash
cd backend
uv run pytest
```

검증 범위:

- `GET /health`
- `POST /api/chat/stream` SSE frame contract
- mocked OpenAI response 기반 `message_delta`, `artifact`, `done` 이벤트
- canvas snapshot 기반 `canvas_patch` 이벤트
- analytics tool filter
- backend error event

Frontend -> Playwright MCP level testing:

- `http://127.0.0.1:2929/study` 접속
- chat panel과 canvas panel 표시
- chat submit 후 assistant streaming text 표시
- generated `Graph` artifact Add 버튼으로 canvas 추가
- generated `Markdown` artifact drag/drop으로 canvas 추가
- canvas item resize handle grid 단위 동작
- canvas patch 적용 후 canvas item 내용 변경
- backend down/error 상황에서 recoverable error UI 표시

Static checks:

```bash
pnpm exec tsc --noEmit
pnpm exec eslint src/study src/app/study --max-warnings=0
```
