# Infra Codex OAuth Proxy 완료 문서

## 개요

`20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy`는 ChatGPT OAuth 인증을 이용해 로컬에서 OpenAI-compatible API 엔드포인트를 제공하는 프록시 인프라다.

목표는 다음과 같다.

- OpenAI SDK, LangChain, LangGraph 같은 기존 OpenAI-compatible 클라이언트가 `OPENAI_BASE_URL`만 바꿔 로컬 프록시를 사용하게 한다.
- ChatGPT OAuth 토큰을 로컬 `.config/chatgpt_auth.json`에 저장하고, API 호출 시 자동으로 access token을 갱신한다.
- `/v1/chat/completions` 요청을 ChatGPT Codex backend의 Responses API 호출로 변환한다.
- `/v1/responses` 요청은 Responses 형태를 최대한 유지하면서 Codex backend로 전달한다.
- Docker Compose 기반으로 Reason Hwang infra에서 반복 실행 가능한 로컬 서비스를 제공한다.

이 구성은 공식 OpenAI API 키 대체 서비스가 아니라, 신뢰 가능한 로컬 머신에서 Codex/ChatGPT OAuth 기반 호출을 실험하고 검증하기 위한 개발 인프라다.

## 디렉터리 구조

```text
infra/2-codex-oauth-proxy/
├── core/
│   ├── __init__.py
│   ├── api_translator.py
│   ├── constants.py
│   ├── oauth_login.py
│   ├── proxy_server.py
│   └── token_manager.py
├── proxy-server/
│   └── main.py
├── examples/
│   ├── sdk.py
│   └── langgraph.py
├── Dockerfile
├── docker-compose.yml
├── package.json
├── pyproject.toml
├── uv.lock
├── .env.example
├── .dockerignore
├── .gitignore
└── README.md
```

주요 책임은 다음과 같이 나뉜다.

| 영역 | 파일 | 역할 |
| --- | --- | --- |
| OAuth 설정 | `core/constants.py` | OAuth client, authorize/token URL, callback port, auth file, proxy host/port 정의 |
| 로그인 | `core/oauth_login.py` | PKCE 로그인, callback/manual callback 처리, token 저장 |
| 토큰 관리 | `core/token_manager.py` | auth 파일 로드, refresh token 기반 access token 갱신, 원자적 저장 |
| API 변환 | `core/api_translator.py` | Chat Completions 요청/응답과 Responses API 구조 변환 |
| 프록시 서버 | `core/proxy_server.py` | aiohttp 라우팅, upstream forwarding, health check |
| 실행 진입점 | `proxy-server/main.py` | CLI 인자 처리, 서버 실행/종료, 환경변수 inject |
| 컨테이너 | `Dockerfile`, `docker-compose.yml` | uv 기반 이미지 빌드, 로컬 포트 바인딩, auth config mount |
| 검증 예제 | `examples/sdk.py`, `examples/langgraph.py` | OpenAI SDK와 LangGraph smoke test |

## 실행 모델

### 로컬 Python 실행

의존성은 `uv`로 관리한다.

```bash
cd 20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy
uv sync
```

최초 인증은 브라우저 기반 OAuth flow로 진행한다.

```bash
uv run python -m core.oauth_login --manual-callback
```

인증 결과는 아래 경로에 저장된다.

```text
20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config/chatgpt_auth.json
```

프록시는 다음 명령으로 실행한다.

```bash
uv run python proxy-server/main.py --serve
```

기본 엔드포인트는 다음과 같다.

```text
http://127.0.0.1:18741/health
http://127.0.0.1:18741/v1/responses
http://127.0.0.1:18741/v1/chat/completions
```

### Docker Compose 실행

Docker 이미지는 `ghcr.io/astral-sh/uv:python3.11-bookworm-slim` 기반으로 빌드된다. 컨테이너는 interactive OAuth login을 수행하지 않고, host의 `.config`를 `/app/.config`로 mount해서 기존 auth JSON을 사용한다.

```bash
cd 20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy
pnpm run infra:up
```

Compose 설정은 다음 특성을 가진다.

- 서비스명: `codex-oauth-proxy`
- 컨테이너명: `codex-oauth-proxy`
- 재시작 정책: `unless-stopped`
- 내부 포트: `18741`
- host 바인딩: `127.0.0.1:${CODEX_OAUTH_PROXY_PORT:-18741}:18741`
- auth config mount: `${CODEX_OAUTH_PROXY_CONFIG_DIR:-./.config}:/app/.config`

상태 확인:

```bash
pnpm run infra:ps
docker ps --filter name=codex-oauth-proxy
curl http://127.0.0.1:18741/health
```

중지:

```bash
pnpm run infra:down
```

## OAuth 인증 흐름

`core/oauth_login.py`는 PKCE 기반 OAuth flow를 구현한다.

1. `code_verifier`와 `code_challenge`를 생성한다.
2. `https://auth.openai.com/oauth/authorize`로 브라우저 로그인을 시작한다.
3. redirect URI는 `http://localhost:1455/auth/callback`을 사용한다.
4. 자동 callback이 어려운 환경에서는 `--manual-callback`으로 브라우저 주소창의 callback URL을 직접 붙여 넣는다.
5. authorization code를 `https://auth.openai.com/oauth/token`에 전달해 token set을 받는다.
6. `id_token` claim에서 `account_id`를 추출한다.
7. `.config/chatgpt_auth.json`에 `access_token`, `refresh_token`, `expires_at`, `account_id`, `issued_at`, `auth_method`를 저장한다.

토큰 파일은 atomic write 방식으로 저장하고 권한을 `0600`으로 제한한다.

## 토큰 갱신

`core/token_manager.py`는 프록시 요청 시 유효한 access token을 제공한다.

- 시작 시 auth 파일을 읽고 refresh token 존재 여부를 확인한다.
- access token 만료 5분 전부터 refresh 대상으로 판단한다.
- refresh token으로 새 access token을 발급받아 `.config/chatgpt_auth.json`에 다시 저장한다.
- refresh 실패 또는 refresh token 부재 시 재로그인이 필요한 인증 오류를 반환한다.
- `asyncio.Lock`으로 동시 요청 중 중복 refresh를 방지한다.

## API 프록시 흐름

프록시 서버는 `aiohttp` 기반이다.

### `/health`

토큰 획득 가능 여부를 확인하고 다음 형태로 응답한다.

```json
{
  "status": "ok",
  "token_valid": true
}
```

### `/v1/chat/completions`

OpenAI Chat Completions 호환 요청을 받아 ChatGPT Codex backend의 Responses API 요청으로 변환한다.

주요 변환:

- `messages`를 Responses API `input`으로 변환
- system message를 `instructions`로 분리
- `max_tokens`를 `max_output_tokens`로 변환
- Chat Completions `tools[].function` 구조를 Responses API function tool 구조로 flatten
- `response_format.json_schema`를 `text.format`으로 변환
- 일부 미지원 모델을 `gpt-5.4-mini`로 매핑
- Codex backend 요구사항에 맞춰 `store=false`, `stream=true`를 강제

upstream 응답은 다시 Chat Completions 형태로 변환한다.

- Responses `output_text`를 `choices[0].message.content`로 변환
- Responses `function_call`을 Chat Completions `tool_calls`로 변환
- usage 필드를 `prompt_tokens`, `completion_tokens`, `total_tokens`로 변환

### `/v1/responses`

Responses API 형태의 요청을 그대로 사용하는 클라이언트를 위한 passthrough endpoint다.

다만 Codex backend 호환을 위해 다음 보정은 수행한다.

- 모델명 매핑
- `store=false`, `stream=true` 강제
- `instructions` 누락 시 기본값 삽입
- 문자열 `input`을 user message list로 정규화
- Codex backend에서 거부하는 일부 파라미터 제거: `max_output_tokens`, `include`, `previous_response_id`
- 빈 `tools: []` 제거

응답은 Responses API 형태 그대로 반환한다.

## Upstream 통신

실제 호출 대상은 다음 endpoint다.

```text
https://chatgpt.com/backend-api/codex/responses
```

요청 헤더:

```text
Authorization: Bearer <access_token>
Content-Type: application/json
OpenAI-Beta: responses=experimental
accept: text/event-stream
chatgpt-account-id: <account_id, if present>
```

Codex backend는 SSE를 반환할 수 있으므로 `collect_sse_to_response`가 `response.completed`, `response.failed`, `response.output_item.done`, `response.output_text.delta` 이벤트를 수집해 최종 Responses object를 재구성한다.

## 클라이언트 사용법

OpenAI SDK 계열 클라이언트는 다음 환경변수만 지정하면 된다.

```bash
export OPENAI_BASE_URL=http://127.0.0.1:18741/v1
export OPENAI_API_KEY=chatgpt-oauth-placeholder
```

SDK smoke test:

```bash
OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
OPENAI_API_KEY=chatgpt-oauth-placeholder \
uv run python examples/sdk.py
```

LangGraph smoke test:

```bash
OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
OPENAI_API_KEY=chatgpt-oauth-placeholder \
uv run python examples/langgraph.py
```

curl 테스트:

```bash
curl -s http://127.0.0.1:18741/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer chatgpt-oauth-placeholder" \
  -d '{
    "model": "gpt-5.4-mini",
    "messages": [
      {"role": "user", "content": "Say hello in Korean."}
    ]
  }'
```

## 보안 기준

이 인프라에서 가장 중요한 보안 대상은 `.config/chatgpt_auth.json`이다.

운영 원칙:

- `.config/chatgpt_auth.json`은 커밋하지 않는다.
- `.config/`, `.env`, `.env.*`는 `.gitignore` 대상이다.
- 컨테이너는 `127.0.0.1`에만 포트를 바인딩한다.
- 신뢰 가능한 로컬 머신에서만 실행한다.
- 외부 네트워크나 공용 서버에 노출하지 않는다.
- Docker 실행 시 auth 파일은 host mount로만 제공한다.

토큰 갱신 실패, 계정 전환, refresh token 만료가 의심되는 경우 다음 명령으로 재인증한다.

```bash
uv run python -m core.oauth_login --force --manual-callback
```

## 운영 명령

`package.json`에 정의된 주요 명령은 다음과 같다.

| 명령 | 설명 |
| --- | --- |
| `pnpm run oauth` | manual callback 방식 OAuth 로그인 |
| `pnpm run infra:up` | Docker Compose 백그라운드 실행 |
| `pnpm run infra:down` | Docker Compose 중지 및 compose 리소스 정리 |
| `pnpm run infra:ps` | Compose 서비스 상태 확인 |
| `pnpm run build` | Docker image build |
| `pnpm run dev` | 로컬 Python 프록시 실행 |
| `pnpm run start` | 로컬 Python 프록시 실행 |
| `pnpm run lint` | Python compileall 기반 문법 검사 |
| `pnpm run typecheck` | Python compileall 기반 검사 |
| `pnpm run test:sdk` | OpenAI SDK smoke test |
| `pnpm run test:langgraph` | LangGraph smoke test |
| `pnpm run clean` | venv/cache/coverage/runtime cache 제거 |

## 장애 대응

### 컨테이너 이름 충돌

증상:

```text
Conflict. The container name "/codex-oauth-proxy" is already in use
```

원인:

- `container_name: codex-oauth-proxy`는 Docker daemon 전체에서 유일해야 한다.
- 종료된 이전 컨테이너가 같은 이름을 점유하고 있을 수 있다.

확인:

```bash
docker ps -a --filter name=codex-oauth-proxy
```

해결:

```bash
docker rm codex-oauth-proxy
pnpm run infra:up
```

### 인증 파일 없음

증상:

- `/health`의 `token_valid`가 `false`
- API 호출 시 authentication error

해결:

```bash
uv run python -m core.oauth_login --manual-callback
```

Docker 사용 시 `.config/chatgpt_auth.json`이 mount되는 경로에 존재하는지 확인한다.

### refresh 실패

증상:

- token refresh failed
- re-login required

해결:

```bash
uv run python -m core.oauth_login --force --manual-callback
pnpm run infra:down
pnpm run infra:up
```

### 포트 충돌

기본 포트는 `18741`이다. 다른 포트를 쓰려면 `.env` 또는 shell env로 지정한다.

```bash
CODEX_OAUTH_PROXY_PORT=18742 pnpm run infra:up
```

클라이언트도 동일하게 변경한다.

```bash
OPENAI_BASE_URL=http://127.0.0.1:18742/v1
```

## 검증 결과

현재 완료 기준:

- OAuth token file 기반 로컬 실행 가능
- Docker Compose 실행 가능
- `127.0.0.1:18741` 포트 바인딩 확인
- `/health` endpoint 제공
- `/v1/chat/completions` 호환 endpoint 제공
- `/v1/responses` passthrough endpoint 제공
- OpenAI SDK smoke test 경로 제공
- LangGraph smoke test 경로 제공
- `.config` secret 제외 규칙 적용
- 컨테이너 이름 충돌 시 복구 절차 확인

최근 확인된 실행 상태:

```text
codex-oauth-proxy Up
127.0.0.1:18741->18741/tcp
ChatGPT OAuth proxy listening at http://127.0.0.1:18741/v1
Health check: http://127.0.0.1:18741/health
```

## 남은 주의사항

- 이 프록시는 로컬 개발 인프라 용도이며, 공용 API gateway로 운영하지 않는다.
- `.config/chatgpt_auth.json`은 개인 인증 자산이므로 백업/공유/커밋 대상이 아니다.
- ChatGPT/Codex backend의 허용 파라미터와 모델 지원은 바뀔 수 있으므로, 400 오류가 늘어나면 `api_translator.py`의 passthrough 보정 목록과 모델 매핑을 재검토한다.
- Docker Compose의 고정 `container_name`은 운영 편의가 있지만 이름 충돌 가능성이 있으므로, 여러 사본을 동시에 띄울 경우 compose 파일을 조정해야 한다.
