# 구조

이 프로젝트는 Codex CLI을 OpenAI API 처럼 만들어주는 리버스 프록시서버다.
- API 키 대신 ChatGPT OAuth 토큰을 사용하며, 기본적으로 `127.0.0.1:18741`에서 실행


## OAuth 토큰 발급

프로젝트 디렉터리에서 다음 명령으로 로그인한다.

```bash
uv sync
uv run python -m core.oauth_login --manual-callback
( "oauth": "uv run python -m core.oauth_login --manual-callback" ) 실행
```

브라우저 로그인이 끝나면 주소 표시줄의 전체 callback URL을 터미널에 붙여 넣는다. 
발급된 access token, refresh token, account ID는 다음 파일에 저장된다.  

```text
.config/chatgpt_auth.json
```

토큰 파일은 비밀 정보이므로 저장소에 커밋하지 않는다. 
access token이 만료되기 5분 전부터 `TokenManager`가 refresh token을 사용해 자동 갱신하며, 재인증이 필요하면 다음 명령을 사용한다.

```bash
uv run python -m core.oauth_login --force --manual-callback
```

## Codex OAuth 토큰으로 Codex 호출 후 Open AI API Responses 엔드포인트를 노출

### 어떻게 Codex을 호출하나요? 

`aiohttp`는 비동기 HTTP 서버와 클라이언트를 함께 제공하는 라이브러리
- 과정 : 로컬 OpenAI 호환 API 요청을 받고, 같은 이벤트 루프에서 ChatGPT Codex API를 비동기로 호출하는 데 사용
- Codex 응답을 기다리는 동안에도 다른 요청을 처리할 수 있어 프록시 서버에 적합  
- 이 프록시는 터미널의 `codex` 명령이나 Codex CLI 프로세스를 실행하지 않는다. 
- Codex CLI 출력물을 parsing하는 subprocess wrapper가 아니라, ChatGPT OAuth 인증으로 Codex 내부 HTTP 엔드포인트를 직접 호출하고 이를 OpenAI 호환 REST API로 감싸는 구조다.


프록시는 ChatGPT OAuth access token과 account ID를 헤더에 넣어 다음 엔드포인트를 호출한다.
```text
POST https://chatgpt.com/backend-api/codex/responses
```

Codex 요청에는 `store=false`, `stream=true`가 적용된다. 업스트림 SSE 응답은 프록시가 끝까지 수집한 뒤 JSON으로 변환해 반환한다.

로컬에는 다음 REST API를 노출한다.
```text
POST /v1/responses
POST /v1/chat/completions
GET  /v1/models
GET  /health
```

## API Spec

### `GET /v1/models`

실제 Codex 엔드포인트 호출로 검증된 지원 모델 목록을 OpenAI Models API 형식으로 반환한다. OAuth 인증이나 업스트림 호출 없이 로컬 `core/models.py`의 목록을 사용한다.

응답 예시:

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-5.6-sol",
      "object": "model",
      "created": 0,
      "owned_by": "openai"
    },
    {
      "id": "gpt-5.4-mini",
      "object": "model",
      "created": 0,
      "owned_by": "openai"
    }
  ]
}
```

`data`에는 `SUPPORTED_CODEX_MODELS`만 포함하며, 현재 미지원 모델과 레거시 alias는 제외한다.

### `POST /v1/responses`

Codex Responses API 형식으로 요청하고 응답받는다.

```json
{
  "model": "gpt-5.4-mini",
  "input": "한 문장으로 인사해줘."
}
```

응답 예시:

```json
{
  "id": "resp_abc123",
  "object": "response",
  "status": "completed",
  "model": "gpt-5.4-mini",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "안녕하세요! 무엇을 도와드릴까요?"
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 15,
    "output_tokens": 12,
    "total_tokens": 27
  }
}
```

응답 텍스트 경로는 `output[0].content[0].text`다.

### `POST /v1/chat/completions`

OpenAI Chat Completions 형식으로 요청한다. 프록시가 요청을 Responses 형식으로 변환해 Codex를 호출하고, 결과를 다시 Chat Completions 형식으로 반환한다.

```json
{
  "model": "gpt-5.4-mini",
  "messages": [
    {
      "role": "user",
      "content": "한 문장으로 인사해줘."
    }
  ],
  "stream": false
}
```

응답 예시:

```json
{
  "id": "chatcmpl-resp_abc123",
  "object": "chat.completion",
  "model": "gpt-5.4-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "안녕하세요! 무엇을 도와드릴까요?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 12,
    "total_tokens": 27
  }
}
```

응답 텍스트 경로는 `choices[0].message.content`다. 현재 클라이언트 대상 SSE 스트리밍은 지원하지 않으므로 `stream=false`로 사용한다.

## Proxy Server

로컬에서는 다음 명령으로 포그라운드 실행한다.

```bash
uv run python proxy-server/main.py --serve
```

Docker Compose는 이미지를 빌드하고 호스트의 `.config`를 컨테이너 `/app/.config`에 마운트한다. 따라서 OAuth 로그인은 호스트에서 먼저 수행해야 하며, 컨테이너에서 갱신된 토큰도 같은 디렉터리에 보존된다.

```bash
uv run python -m core.oauth_login --manual-callback
docker compose up -d --build
```

컨테이너는 내부적으로 `0.0.0.0:18741`에 바인딩하지만, 호스트에는 안전을 위해 `127.0.0.1:18741`로만 공개한다. 상태는 다음 명령으로 확인한다.

```bash
curl http://127.0.0.1:18741/health
docker compose ps
```
