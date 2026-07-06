# codex-oauth-proxy-init Gradate

## Design

`/Users/studio/workspace/projects/chatgpt-oauth-proxy`의 Python/uv 기반 OAuth proxy 코드를 `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy`로 복사하고, Docker 및 Reason Hwang 인프라 compose에 통합한다.

핵심 설계 원칙:

- 기존 proxy 동작은 유지한다.
- OAuth interactive login은 Docker 내부에서 수행하지 않는다.
- 호스트에서 생성한 `.config/chatgpt_auth.json`을 컨테이너 `/app/.config`로 bind mount한다.
- 컨테이너는 mount된 auth JSON을 읽고 refresh 결과를 같은 mount 경로에 저장한다.
- proxy HTTP port는 host에서 `127.0.0.1`에만 publish한다.
- 토큰 파일은 이미지 build context와 git 추적 대상에서 제외한다.

## Implementation Draft

### Architecture Overview

```
host
├── 20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy
│   ├── core/                       # copied proxy core
│   ├── proxy-server/main.py        # copied CLI, Docker bind host support added
│   ├── examples/                   # copied smoke examples
│   ├── Dockerfile                  # new container image
│   ├── .dockerignore               # excludes secrets/cache/env
│   └── .config/chatgpt_auth.json   # host-created secret, ignored, mounted only
└── 20-portfolio/1-reason-hwang/infra/1-infra-graph-rag
    ├── docker-compose.yml          # codex-oauth-proxy service
    └── .env.example                # proxy port/config dir variables
```

The root script `pnpm infra-up:reason-hwang` already runs:

```bash
cd 20-portfolio/1-reason-hwang/infra/1-infra-graph-rag && docker-compose up -d
```

Because the existing compose file now includes `codex-oauth-proxy`, that script brings up the proxy together with the rest of the infrastructure.

### Modules

- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/core/oauth_login.py`
  - Copied from the reference project.
  - Host-side one-time OAuth flow remains available via `uv run python -m core.oauth_login --manual-callback`.
- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/core/token_manager.py`
  - Copied from the reference project.
  - Reads and refreshes `.config/chatgpt_auth.json`.
- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/core/proxy_server.py`
  - Copied from the reference project.
  - Exposes `/health`, `/v1/responses`, `/v1/chat/completions`.
- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/core/__init__.py`
  - Starts the aiohttp app.
  - Updated to allow startup without a valid auth file so `/health` can report `token_valid: false`.
  - Updated to accept a configurable bind host.
- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/core/constants.py`
  - Copied constants.
  - Added `CHATGPT_OAUTH_PROXY_HOST` support.
- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/proxy-server/main.py`
  - Copied CLI.
  - Added `--host` to support `0.0.0.0` inside Docker while host publish remains localhost-only.
- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/Dockerfile`
  - Builds from `ghcr.io/astral-sh/uv:python3.11-bookworm-slim`.
  - Installs dependencies with `uv sync --frozen --no-dev`.
  - Runs `proxy-server/main.py --serve --host 0.0.0.0 --port 18741 --no-inject-env`.
- `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.dockerignore`
  - Excludes `.config`, `.venv`, pycache, env files, logs, and git metadata.
- `20-portfolio/1-reason-hwang/infra/1-infra-graph-rag/docker-compose.yml`
  - Adds `codex-oauth-proxy` service with build context `../2-codex-oauth-proxy`.
  - Publishes `127.0.0.1:${CODEX_OAUTH_PROXY_PORT:-18741}:18741`.
  - Mounts `${CODEX_OAUTH_PROXY_CONFIG_DIR:-../2-codex-oauth-proxy/.config}:/app/.config`.

### Interfaces

- Host OAuth:
  - `cd 20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy && uv run python -m core.oauth_login --manual-callback`
  - `cd 20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy && uv run python -m core.oauth_login --force --manual-callback`
- Local proxy:
  - `cd 20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy && uv run python proxy-server/main.py --serve`
  - `GET http://127.0.0.1:18741/health`
  - `POST http://127.0.0.1:18741/v1/responses`
  - `POST http://127.0.0.1:18741/v1/chat/completions`
- Docker:
  - `docker-compose -f 20-portfolio/1-reason-hwang/infra/1-infra-graph-rag/docker-compose.yml build codex-oauth-proxy`
  - `docker-compose -f 20-portfolio/1-reason-hwang/infra/1-infra-graph-rag/docker-compose.yml up -d codex-oauth-proxy`
  - `pnpm infra-up:reason-hwang`
- OpenAI-compatible client env:
  - `OPENAI_BASE_URL=http://127.0.0.1:18741/v1`
  - `OPENAI_API_KEY=chatgpt-oauth-placeholder`

### Dependencies

- Python `>=3.10`
- `uv`
- `aiohttp`
- `openai`
- `langchain-openai`, `langgraph` for examples
- Docker / `docker-compose`
- Existing root `pnpm infra-up:reason-hwang` script
- Existing Reason Hwang compose stack

### Data Flow

1. Host runs the one-time OAuth command in `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy`.
2. OAuth flow writes `.config/chatgpt_auth.json` on the host.
3. Docker compose mounts `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config` into the container at `/app/.config`.
4. Proxy starts even if the file is missing; `/health` reports `token_valid: false`.
5. When the file exists, `TokenManager.get_token()` loads or refreshes the token.
6. `/v1/responses` requests are prepared for the ChatGPT/Codex Responses upstream.
7. `/v1/chat/completions` requests are translated to Responses upstream and translated back to Chat Completions format.

## Gap Analysis (Pre-Validate)

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| Copy reference proxy into `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy` | `README.md`, `pyproject.toml`, `uv.lock`, `core/`, `examples/`, `proxy-server/` copied | Done |
| Exclude secrets and generated files | `.config` was not copied; `.dockerignore` and app `.gitignore` exclude `.config`, `.venv`, pycache, env files | Done |
| Dockerfile builds proxy server | `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/Dockerfile`; verified with `docker-compose ... build codex-oauth-proxy` | Done |
| Docker server starts without interactive OAuth | `core/__init__.py` starts app even if `validate_or_fail()` fails; verified `/health` returns `token_valid: false` | Done |
| Docker bind host supports port publishing | `CHATGPT_OAUTH_PROXY_HOST`, `--host`, Docker CMD `--host 0.0.0.0` | Done |
| Host publish remains localhost-only | compose port `127.0.0.1:${CODEX_OAUTH_PROXY_PORT:-18741}:18741` | Done |
| Auth JSON is volume mounted | compose volume `${CODEX_OAUTH_PROXY_CONFIG_DIR:-../2-codex-oauth-proxy/.config}:/app/.config` | Done |
| `infra-up:reason-hwang` includes proxy | existing root script runs compose directory; compose now includes `codex-oauth-proxy` service | Done |
| Operational docs updated | `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/README.md` documents Docker and Reason Hwang infra flow | Done |
| Gradate gap below 1% | All planned implementation items have matching code/config evidence | Done |

## Implementation Notes

- The reference auth JSON at `/Users/studio/workspace/projects/chatgpt-oauth-proxy/.config/chatgpt_auth.json` was not copied automatically because it is a secret. The README documents an explicit copy command if the user chooses to reuse it.
- `docker-compose config` resolves the proxy bind mount to `20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config` and the port to `127.0.0.1:18741`.
- `python3 -m compileall` passed for copied Python modules and examples.
- Docker build passed for `codex-oauth-proxy`.
- Runtime smoke passed without auth file: `GET /health` returned `{"status": "ok", "token_valid": false}`.
