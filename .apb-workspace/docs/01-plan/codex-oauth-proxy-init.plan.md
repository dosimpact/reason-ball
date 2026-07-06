# codex-oauth-proxy-init Plan

## Goal

`/Users/studio/workspace/projects/chatgpt-oauth-proxy`의 코드를 `cp`로 그대로 가져와 이 저장소 안에 Codex/OpenAI-compatible 클라이언트가 로컬 ChatGPT OAuth 세션을 통해 호출할 수 있는 초기 OAuth proxy 애플리케이션을 만든다.

초기 결과물은 실행 가능한 로컬 Python 서비스, 호스트에서 생성한 OAuth 토큰 파일을 읽는 proxy server, OpenAI-compatible 엔드포인트, SDK/LangGraph smoke 예제, Docker 기반 proxy server 제공, 그리고 기존 Reason Hwang 인프라 기동 명령에 포함되는 compose 통합을 포함해야 한다.

## Scope

- In scope:
- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy` 신규 앱 디렉터리 생성
- `/Users/studio/workspace/projects/chatgpt-oauth-proxy`의 전체 소스 파일을 `cp`로 `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy`에 복사
- 복사 후 필요한 변경은 이 저장소 통합에 필요한 최소 범위로 제한:
  - secret/config ignore 보강
  - Docker 실행에 필요한 entrypoint/build 설정
  - infra compose 통합을 위한 경로/볼륨/포트 설정
- `uv` 기반 Python 프로젝트 메타데이터(`pyproject.toml`, lock 파일 생성 여부는 Gradate에서 결정)
- 참고 프로젝트의 핵심 구조를 유지:
  - `core/oauth_login.py`: ChatGPT OAuth device/browser 로그인 및 manual callback 지원
  - `core/token_manager.py`: 로컬 토큰 파일 로드, 만료 판단, refresh, 원자적 저장
  - `core/proxy_server.py`: `aiohttp` 기반 로컬 프록시 서버
  - `core/api_translator.py`: Chat Completions와 Responses 요청/응답 변환
  - `core/constants.py`: OAuth/API URL, 로컬 포트, auth 파일 경로 상수
  - `proxy-server/main.py`: CLI 진입점
  - `examples/sdk.py`, `examples/langgraph.py`: smoke 실행 예제
- Docker 제공:
  - `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/Dockerfile`
  - 필요 시 `.dockerignore`
  - 컨테이너에서 proxy server가 기본 실행되도록 구성
  - 로컬 OAuth 토큰 파일은 이미지에 포함하지 않고 호스트의 `.config/chatgpt_auth.json`을 bind mount로 제공
  - 컨테이너는 mount된 auth JSON을 읽고, 만료 시 refresh 결과를 같은 mount 경로에 다시 저장할 수 있어야 함
- Reason Hwang 인프라 통합:
  - `20-portfolio/1-reason-hwang/infra/1-infra-graph-rag/docker-compose.yml`에 `codex-oauth-proxy` 서비스 추가
  - 루트 `package.json`의 기존 스크립트 `"infra-up:reason-hwang": "cd 20-portfolio/1-reason-hwang/infra/1-infra-graph-rag && docker-compose up -d"`를 실행하면 proxy server도 함께 제공되도록 구성
  - `.env.example`에 proxy 관련 포트와 auth JSON mount 경로 변수를 추가
- 기본 엔드포인트:
  - `GET /health`
  - `POST /v1/responses`
  - `POST /v1/chat/completions`
- 기본 보안 정책:
  - 서버는 기본적으로 `127.0.0.1`에만 bind
  - OAuth 토큰 파일은 호스트 앱 디렉터리의 `.config/chatgpt_auth.json`에 저장하고 Docker 컨테이너에 volume mount
  - 토큰 파일은 `.gitignore`에 포함하고 저장 권한은 가능한 경우 `0600`으로 제한
- OAuth 인증 운영 방식:
  - 최초 인증은 호스트에서 `uv run python -m core.oauth_login --manual-callback`로 수행
  - 생성된 `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config/chatgpt_auth.json`을 Docker compose가 컨테이너의 `/app/.config/chatgpt_auth.json`로 mount
  - Docker server는 별도 interactive login 없이 mount된 auth JSON 상태를 `/health`에서 확인
  - 토큰 만료 시 `TokenManager`가 refresh token으로 갱신하고 mount된 파일에 저장
- README 또는 앱 문서에 설치, 로그인, 프록시 실행, curl/SDK smoke 절차 기록
- Out of scope:
- 원격 배포, 퍼블릭 네트워크 노출
- 다중 사용자/멀티테넌트 계정 관리
- 공식 OpenAI API key 대체 서비스로 포장하는 문구 또는 외부 서비스화
- UI 대시보드
- 장기 운영 모니터링, metrics, tracing
- 참고 프로젝트의 동작을 임의로 확장하는 대규모 리팩터링
- OAuth 로그인 자체를 컨테이너 내부에서 브라우저 자동화하는 기능
- Docker 서버 내부에서 interactive OAuth login을 시작하거나 브라우저 callback을 처리하는 기능

## Verification

- Implementation scope:
  - `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy`가 독립적으로 `uv sync`, OAuth login, proxy serve, smoke examples를 실행할 수 있어야 한다.
  - 루트 pnpm/Turborepo 구조는 훼손하지 않고, Python 앱은 워크스페이스의 `apps/` 하위 runnable application으로 둔다.
  - 참고 프로젝트 코드는 우선 `cp`로 그대로 가져오고, 변경은 Docker/infra 통합과 secret ignore 보강에 필요한 범위로 제한한다.
  - `docker-compose up -d`가 실행되는 Reason Hwang 인프라 compose에 proxy server 서비스가 포함되어야 한다.
  - Docker 서비스는 호스트에서 생성된 `.config/chatgpt_auth.json`을 volume mount로 읽어야 하며, 이미지 안에 token 파일이 없어야 한다.
- Public interfaces:
  - CLI:
    - `uv run python -m core.oauth_login --manual-callback`
    - `uv run python -m core.oauth_login --force --manual-callback`
    - `uv run python proxy-server/main.py --serve`
  - HTTP:
    - `GET http://127.0.0.1:18741/health`
    - `POST http://127.0.0.1:18741/v1/responses`
    - `POST http://127.0.0.1:18741/v1/chat/completions`
  - Docker/infra:
    - `docker build` 가능한 `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/Dockerfile`
    - 호스트 최초 인증: `cd 20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy && uv run python -m core.oauth_login --manual-callback`
    - `cd 20-portfolio/1-reason-hwang/infra/1-infra-graph-rag && docker-compose up -d codex-oauth-proxy`
    - `pnpm infra-up:reason-hwang`
  - OpenAI-compatible env:
    - `OPENAI_BASE_URL=http://127.0.0.1:18741/v1`
    - `OPENAI_API_KEY=chatgpt-oauth-placeholder`
- External dependencies:
  - Python `>=3.10`
  - `uv`
  - `aiohttp`
  - `openai`
  - `langchain-openai`, `langgraph` for examples only
  - Docker / Docker Compose
  - ChatGPT OAuth/token endpoints and Codex/ChatGPT Responses upstream used by the reference project
- Internal dependencies:
  - Root repository layout and AGENTS.md rule that runnable apps live under `apps/`
  - Existing `infra-up:reason-hwang` script in root `package.json`
  - Existing compose stack at `20-portfolio/1-reason-hwang/infra/1-infra-graph-rag/docker-compose.yml`
  - `.gitignore` coverage for local auth/config secrets
- Risky areas:
  - OAuth tokens are sensitive and must never be committed.
  - Upstream ChatGPT/Codex OAuth or Responses API shape may change.
  - SSE parsing and OpenAI-compatible response translation can fail subtly.
  - Binding beyond localhost would create credential exposure risk.
  - Docker port publishing can accidentally expose the proxy beyond the local machine if host binding is not constrained.
  - Container access to `.config/chatgpt_auth.json` must not bake tokens into the image.
  - Bind-mounted auth JSON must be writable by the container if refresh is expected to persist.
  - If the auth JSON was generated in the old source project path, it must be copied intentionally into `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config/chatgpt_auth.json` or the compose mount path must point to the old file.
  - Reference project is Python/uv while the repository root is pnpm/Turborepo; integration should remain minimal except the requested infra compose wiring.

## Validation

- Project scaffold exists under `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy` with the expected modules and docs.
- Copied source matches the reference project except for intentional repository integration changes.
- Docker image builds and starts the proxy server.
- `pnpm infra-up:reason-hwang` includes the `codex-oauth-proxy` compose service.
- Compose mounts host `.config/chatgpt_auth.json` into the container instead of requiring interactive login inside Docker.
- Secret-bearing files are ignored by git and token writes use restricted permissions where supported.
- Health endpoint returns JSON and reflects token availability without leaking token values.
- Responses and Chat Completions endpoints accept OpenAI-compatible request bodies and return JSON-shaped responses or OpenAI-style errors.
- SDK and LangGraph examples document the expected `OPENAI_BASE_URL` and placeholder API key usage.

### E2E 시나리오

- Given dependencies are installed in `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy`, When `uv run python proxy-server/main.py --serve` starts without a token file, Then startup or `/health` reports the missing-auth state without exposing secrets.
- Given the source copy step is complete, When `diff` is run against `/Users/studio/workspace/projects/chatgpt-oauth-proxy`, Then differences are limited to intentional integration files or documented local changes.
- Given Docker is available, When `docker build` is run for `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy`, Then the image builds without embedding `.config/chatgpt_auth.json`.
- Given a host auth file exists at `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config/chatgpt_auth.json`, When Reason Hwang infrastructure is started with `pnpm infra-up:reason-hwang`, Then Docker Compose mounts that file into `codex-oauth-proxy` and publishes `127.0.0.1:18741`.
- Given the host auth file is missing, When the Docker proxy starts, Then `/health` reports `token_valid: false` or an auth-required state without crashing or exposing secrets.
- Given a valid `.config/chatgpt_auth.json` exists, When the proxy is started and `GET /health` is called, Then the response is JSON with `status: ok` and `token_valid: true`.
- Given the proxy is running with a valid token, When an OpenAI SDK client calls `/v1/responses`, Then the request is forwarded upstream and a Responses-shaped JSON result is returned.
- Given the proxy is running with a valid token, When an OpenAI SDK client calls `/v1/chat/completions`, Then the request/response is translated between Chat Completions and Responses formats.

## Skills

### Gradate 단계

- TBD

### Validate 단계

- TBD

## Reference

- Source project: `/Users/studio/workspace/projects/chatgpt-oauth-proxy`
- Existing auth file example: `/Users/studio/workspace/projects/chatgpt-oauth-proxy/.config/chatgpt_auth.json`
- Reference files inspected:
  - `README.md`
  - `pyproject.toml`
  - `core/proxy_server.py`
  - `core/token_manager.py`
