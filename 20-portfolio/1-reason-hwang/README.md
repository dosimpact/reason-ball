# Reason Hwang Portfolio

Reason Hwang 포트폴리오 워크스페이스입니다. 프론트엔드 호스트, BFF, LangGraph/FastAPI 서비스, 로컬 인프라를 독립 pnpm workspace와 Turborepo로 관리합니다.

## 구성

| 경로 | 역할 | 주요 포트 |
| --- | --- | --- |
| `1-fe-host` | Next.js 프론트엔드 호스트 | `2800` |
| `2-bff-apps` | NestJS BFF 및 remote 앱 프록시 | `2801` |
| `3-langgraph-fast` | FastAPI + LangGraph 서비스 | `8000` |
| `infra/1-infra-graph-rag` | Neo4j, PostgreSQL, Loki, Promtail, Grafana | `7474`, `5433`, `3100`, `3001` |
| `infra/2-codex-oauth-proxy` | 로컬 OpenAI 호환 OAuth 프록시 | `18741 -> 2890` |

## 사전 준비

이 디렉터리에서 의존성을 설치합니다.

```bash
pnpm install
```

Python 기반 프로젝트는 `uv`를 사용합니다.

```bash
cd 3-langgraph-fast
uv sync
```

OAuth 프록시를 사용할 경우 토큰 파일이 로컬에 생성됩니다. `infra/2-codex-oauth-proxy/.config/chatgpt_auth.json`은 커밋하거나 공유하지 마세요.

## 빠른 실행

Reason Hwang workspace root에서 개발 서버를 실행합니다.

```bash
pnpm dev
```

인프라가 필요한 기능을 확인할 때는 먼저 Docker Compose 스택을 올립니다.

```bash
pnpm infra:up
pnpm infra:ps
```

종료:

```bash
pnpm infra:down
```

## 개별 실행

프론트엔드:

```bash
pnpm --filter reason-hwang-fe-host dev
```

BFF:

```bash
pnpm --filter @reason-hwang/bff-apps dev
```

LangGraph/FastAPI:

```bash
pnpm --filter reason-hwang-langgraph-fast dev
```

OAuth 프록시:

```bash
cd infra/2-codex-oauth-proxy
uv sync
uv run python -m core.oauth_login --manual-callback
uv run python proxy-server/main.py --serve
```

## 주요 URL

- Frontend: `http://localhost:2800`
- BFF Swagger: `http://localhost:2801/docs/sec`
- LangGraph health: `http://127.0.0.1:8000/health`
- LangGraph run: `POST http://127.0.0.1:8000/graph/run`
- OAuth proxy health: `http://127.0.0.1:18741/health`
- Neo4j Browser: `http://localhost:7474`
- Grafana: `http://localhost:3001`
- Loki ready: `http://localhost:3100/ready`

## 검증

전체 Reason Hwang 영역 빌드:

```bash
pnpm build
```

개별 테스트:

```bash
pnpm --filter reason-hwang-fe-host test:e2e
pnpm --filter @reason-hwang/bff-apps test
pnpm --filter reason-hwang-langgraph-fast test
```

정적 검사:

```bash
pnpm --filter reason-hwang-fe-host lint
pnpm --filter @reason-hwang/bff-apps lint
pnpm --filter reason-hwang-langgraph-fast lint
pnpm --filter reason-hwang-langgraph-fast typecheck
```

## LangGraph API 예시

```bash
curl -X POST http://127.0.0.1:8000/graph/run \
  -H 'content-type: application/json' \
  -d '{"message":"Say hello in one sentence","provider":"openai"}'
```

로컬 OAuth 프록시를 통해 호출하려면 프록시를 먼저 실행하고 `CHATGPT_OAUTH_PROXY_URL`을 설정한 뒤 `provider`를 `chatgpt-oauth-proxy`로 보냅니다.

```bash
CHATGPT_OAUTH_PROXY_URL=http://127.0.0.1:18741 \
pnpm --filter reason-hwang-langgraph-fast dev
```

```bash
curl -X POST http://127.0.0.1:8000/graph/run \
  -H 'content-type: application/json' \
  -d '{"message":"한 문장으로 인사해줘","provider":"chatgpt-oauth-proxy"}'
```

## 운영 메모

- 이 디렉터리의 `package.json`과 `pnpm-lock.yaml`이 Reason Hwang 의존성과 작업을 독립적으로 관리합니다.
- `1-fe-host`는 기본적으로 `REMOTE_BFF_URL=http://localhost:2801`을 바라봅니다.
- `2-bff-apps`는 `PORT` 미설정 시 `2801`로 실행됩니다.
- `infra/1-infra-graph-rag`의 PostgreSQL 기본 포트는 `5433`입니다.
- 빌드 산출물, 캐시, 가상환경, OAuth 토큰은 커밋 대상이 아닙니다.
