# Codex OAuth Proxy

ChatGPT OAuth 인증으로 Codex 응답 API를 호출하고 로컬에 OpenAI 호환 API를 제공하는 경량 `aiohttp` 프록시입니다. Codex CLI를 subprocess로 실행하지 않고 ChatGPT Codex HTTP 엔드포인트를 직접 호출합니다.

> 이 프로젝트는 공식 OpenAI API 서비스나 API 키 대체재가 아닙니다. 신뢰할 수 있는 로컬 환경에서만 사용하고 관련 서비스 약관과 정책을 확인하세요.

## 제공 API

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/health` | 서버 상태와 OAuth 토큰 유효성 확인 |
| `GET` | `/v1/models` | 프록시가 지원하는 Codex 모델 목록 반환 |
| `POST` | `/v1/responses` | OpenAI Responses 형식 전달, `stream=true` SSE 지원 |
| `POST` | `/v1/chat/completions` | Chat Completions 요청을 Responses 형식으로 변환 후 반환 |

기본 모델은 `gpt-5.6-luna`입니다. 지원 모델과 호환 alias의 기준은 `core/models.py`입니다.

## 요구 사항

- Python 3.10 이상
- `uv`
- pnpm
- Docker 및 Docker Compose (`pnpm test:api` 또는 컨테이너 실행 시)
- ChatGPT OAuth 로그인이 가능한 계정

## 설치 및 OAuth 로그인

프로젝트 디렉터리에서 의존성을 설치하고 로그인합니다.

```bash
pnpm install:frozen
pnpm oauth
```

`pnpm oauth`는 다음 명령을 실행합니다.

```bash
uv run python -m core.oauth_login --manual-callback
```

브라우저 로그인을 마친 뒤 주소 표시줄의 전체 callback URL을 터미널에 붙여 넣습니다. 인증 결과는 다음 파일에 생성되거나 갱신됩니다.

```text
.config/chatgpt_auth.json
```

이 파일에는 access token, refresh token, account ID가 포함될 수 있습니다. Git에 커밋하거나 공유하지 마세요. 계정을 변경하거나 재인증해야 한다면 다음 명령을 사용합니다.

```bash
uv run python -m core.oauth_login --force --manual-callback
```

## 실행

### 로컬 Python 프로세스

```bash
pnpm start
```

기본 주소는 `http://127.0.0.1:18741`입니다.

```bash
curl http://127.0.0.1:18741/health
curl http://127.0.0.1:18741/v1/models
```

### Docker Compose

호스트에서 먼저 `pnpm oauth`를 실행한 뒤 컨테이너를 시작합니다.

```bash
pnpm infra:up
pnpm infra:ps
```

Compose는 호스트의 `.config`를 컨테이너의 `/app/.config`에 마운트합니다. 따라서 컨테이너가 같은 OAuth 파일을 읽고, 갱신된 토큰도 호스트에 보존됩니다. 인증 파일은 Docker 이미지에 포함되지 않습니다.

컨테이너는 내부 `0.0.0.0:18741`에서 수신하고 Compose는 기본적으로 호스트의 `127.0.0.1:2890`에 공개합니다.

```bash
curl http://127.0.0.1:2890/health
```

호스트 포트와 인증 디렉터리는 환경변수로 바꿀 수 있습니다.

```bash
CODEX_OAUTH_PROXY_PORT=18741 \
CODEX_OAUTH_PROXY_CONFIG_DIR=./.config \
docker compose up -d --build
```

종료할 때는 다음 명령을 사용합니다. 이 명령은 OAuth 파일을 삭제하지 않습니다.

```bash
pnpm infra:down
```

## 호출 예시

### Responses API

```bash
curl -s http://127.0.0.1:2890/v1/responses \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer chatgpt-oauth-placeholder' \
  -d '{
    "model": "gpt-5.6-luna",
    "input": "한 문장으로 인사해줘.",
    "stream": false
  }'
```

### Chat Completions API

```bash
curl -s http://127.0.0.1:2890/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer chatgpt-oauth-placeholder' \
  -d '{
    "model": "gpt-5.6-luna",
    "messages": [
      {"role": "user", "content": "한 문장으로 인사해줘."}
    ],
    "stream": false
  }'
```

클라이언트가 보내는 placeholder API 키는 OpenAI SDK 호환을 위한 값입니다. 실제 업스트림 인증에는 `.config/chatgpt_auth.json`의 ChatGPT OAuth 토큰을 사용합니다.

## 검증

### 단위 테스트와 정적 검사

```bash
pnpm test:unit
pnpm lint
pnpm typecheck
```

`test:unit`은 `tests/test_*.py`를 Python `unittest`로 실행합니다. `lint`와 `typecheck`는 현재 Python 소스의 컴파일 가능 여부를 검사합니다.

### Bruno API 테스트

```bash
pnpm test:api
```

API 테스트 runner는 다음 순서로 동작합니다.

1. `.config/chatgpt_auth.json`과 refresh token을 확인합니다.
2. Docker Compose 설정을 검증하고 현재 소스로 이미지를 빌드합니다.
3. 프록시의 `/health`와 `token_valid`를 확인합니다.
4. Bruno `local` 환경으로 Chat Completions, 모델 목록, 모델 alias를 검증합니다.
5. 실행 결과를 `api-test/reports/`에 저장합니다.

runner가 직접 시작한 Compose 서비스만 종료합니다. 이미 실행 중이던 서비스가 있으면 새 이미지로 갱신한 뒤 계속 실행 상태로 둡니다.

### SDK 및 LangGraph 확인

Compose 프록시가 `127.0.0.1:2890`에서 실행 중일 때 다음 명령을 사용할 수 있습니다.

```bash
pnpm health-check:sdk
pnpm health-check:langgraph
```

두 예제에 필요한 `openai`, `langchain-openai`, `langgraph`는 개발 의존성입니다. Docker 런타임 이미지는 프록시에 필요한 `aiohttp`와 서버 코드만 포함합니다.

## 주요 명령

| 명령 | 설명 |
| --- | --- |
| `pnpm install:frozen` | `uv.lock`에 고정된 로컬 의존성 설치 |
| `pnpm oauth` | 수동 callback 방식으로 OAuth 로그인 |
| `pnpm start` | 로컬 프록시 실행 (`127.0.0.1:18741`) |
| `pnpm infra:up` | Compose 프록시 시작 |
| `pnpm infra:ps` | SDK 기반 health check 후 컨테이너 상태 표시 |
| `pnpm infra:down` | Compose 프록시 종료 |
| `pnpm build` | `codex-oauth-proxy` Docker 이미지 빌드 |
| `pnpm test:unit` | Python 단위·컴포넌트 테스트 실행 |
| `pnpm test:api` | 실제 OAuth와 Docker를 사용하는 Bruno API 테스트 실행 |
| `pnpm health-check:sdk` | OpenAI SDK 호출 확인 |
| `pnpm health-check:langgraph` | LangGraph 호출 확인 |
| `pnpm clean` | 가상환경, 테스트 산출물, Python 캐시 제거 |

`pnpm clean`은 `.venv`를 제거하므로 이후 `pnpm install:frozen`으로 환경을 복원하세요. `.config`와 OAuth 인증 파일은 삭제하지 않습니다.

## 보안 주의사항

- `.config/chatgpt_auth.json`, `.env`, 로그에 포함된 민감정보를 커밋하지 않습니다.
- 프록시와 Compose 포트는 기본적으로 loopback 주소에만 바인딩합니다.
- `.config` 볼륨을 제거하거나 인증 파일을 삭제하지 않습니다.
- Bruno 컬렉션에는 실제 OAuth 토큰 대신 placeholder Authorization 헤더만 둡니다.

구체적인 API 형식과 내부 동작은 [`docs/Design.md`](docs/Design.md), API 테스트 구조는 [`api-test/README.md`](api-test/README.md)를 참고하세요.
