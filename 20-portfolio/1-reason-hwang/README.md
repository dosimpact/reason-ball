# Reason Hwang Portfolio

Reason Hwang 포트폴리오 워크스페이스입니다. 프론트엔드 호스트, BFF, LangGraph/FastAPI 서비스, 로컬 인프라를 독립 pnpm workspace와 Turborepo로 관리합니다.

## 구성

| 경로 | 역할 | 주요 포트 |
| --- | --- | --- |
| `1-fe-host` | Next.js 프론트엔드 호스트 | `2800` |
| `2-bff-apps` | NestJS BFF 및 remote 앱 프록시 | `2801` |
| `3-langgraph-fast` | FastAPI + LangGraph 서비스 | `8000` |
| `infra/1-infra-graph-rag` | Neo4j, PostgreSQL, Loki, Alloy, Prometheus, exporters, cAdvisor, Grafana | `7474`, `55432`, `3100`, `9090`, `8080`, `3001` |
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
- PostgreSQL: `localhost:55432`
- Grafana: `http://localhost:3001`
- Loki ready: `http://localhost:3100/ready`
- Prometheus: `http://localhost:9090`
- cAdvisor: `http://localhost:8080`

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

## 검증용 MCP 설치 및 연결

[필수 검증 원칙](docs/validation/README.md)에 따라 API는 Bruno CLI, 순수 View는 Storybook, 비즈니스 동작은 Playwright MCP 또는 Chrome DevTools MCP로 검증합니다.

| 도구 | 역할 | 등록 이름 |
| --- | --- | --- |
| Playwright MCP `0.0.82` | 사용자 입력·이동·화면 결과 확인 | `playwright` |
| Chrome DevTools MCP `1.9.0` | 브라우저 동작·콘솔·네트워크 확인 | `chrome-devtools` |
| Storybook MCP addon `10.6.0` | story 탐색·프리뷰·테스트 도구 | `reason-hwang-storybook` |
| Bruno CLI `4.1.0` | `.bru` API E2E 실행 (별도 MCP 불필요) | 해당 없음 |

### 1. 사전 준비

Node.js 22.12 이상(지원되는 LTS 권장), npm/npx, pnpm, Codex CLI, Google Chrome이 필요합니다. 이 프로젝트 루트에서 확인합니다.

```bash
node --version
npx --version
pnpm --version
codex --version
pnpm install
```

Chrome은 운영체제의 기본 설치 위치에 설치합니다. Playwright MCP는 아래 설정에서 설치된 Chrome을 사용하므로 별도의 Playwright Chromium 다운로드가 필요하지 않습니다.

### 2. Codex에 MCP 등록

먼저 `codex mcp list`로 동일 이름의 기존 설정을 확인합니다. 아래 명령은 **사용자 범위 `~/.codex/config.toml`**에 등록하므로 다른 프로젝트에서도 표시됩니다. 기존 설정을 유지하려면 이름과 인자를 확인한 후 필요한 항목만 추가하세요. 버전은 설치 검증한 버전으로 고정했습니다.

```bash
codex mcp add playwright -- npx -y @playwright/mcp@0.0.82 --browser chrome --isolated --headless
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@1.9.0 --isolated --headless --no-usage-statistics --no-performance-crux
codex mcp add reason-hwang-storybook --url http://127.0.0.1:6006/mcp
```

`npx -y`는 지정한 패키지를 다운로드·캐시한 뒤 실행합니다. 두 브라우저 MCP는 별도의 임시 프로필과 headless 브라우저를 사용합니다. 창을 보면서 검증하려면 해당 설정에서 `--headless`를 제거합니다. Chrome DevTools의 사용 통계와 CrUX 외부 조회는 비활성화했습니다.

프로젝트 범위만 원하면 동일한 command/args 또는 URL을 신뢰된 프로젝트의 `.codex/config.toml` 안 `[mcp_servers.<이름>]` 테이블에 설정할 수 있습니다. 사용자 설정과 프로젝트 설정에 같은 이름을 중복 관리하지 마세요. 자세한 설정은 [공식 Codex MCP 문서](https://developers.openai.com/codex/mcp)를 따릅니다.

### 3. Storybook MCP 서버 실행

프로젝트에는 `@storybook/addon-mcp` 의존성과 `1-fe-host/.storybook/main.ts`의 addon 등록이 이미 있습니다. 설치된 addon은 개발 서버의 `/mcp`를 제공합니다.

```bash
pnpm --filter reason-hwang-fe-host storybook
```

기본 UI는 `http://127.0.0.1:6006`, MCP는 `http://127.0.0.1:6006/mcp`입니다. Storybook 서버를 실행한 상태에서 MCP를 연결합니다. 다른 프로세스가 포트를 쓰면 종료하거나 재사용하지 말고, 소유한 서버를 다른 포트에 띄워 MCP URL도 맞춥니다.

```bash
pnpm --filter reason-hwang-fe-host storybook --port 16006 --ci --no-open
codex mcp add reason-hwang-storybook --url http://127.0.0.1:16006/mcp
```

대체 포트 사용 후 기본값으로 돌아갈 때는 같은 이름에 `http://127.0.0.1:6006/mcp`를 다시 등록합니다. Storybook addon의 도구 제공이 실제 story 테스트 성공을 의미하지는 않습니다.

### 4. Bruno CLI 준비

[Bruno 스킬](../../.agentic-playbook-rc/apb-bruno-api-tests/SKILL.md)을 먼저 읽고 기존 컬렉션·환경·시나리오를 사용합니다. 별도 전역 설치 없이 다음 명령으로 고정 버전을 준비할 수 있습니다.

```bash
npx -y @usebruno/cli@4.1.0 --version
```

패키지의 기존 실행 스크립트를 우선 사용합니다. CLI로 직접 실행할 때는 테스트 서버와 인증·DB를 준비한 뒤 해당 컬렉션 디렉토리에서 실행합니다. 예를 들어 BFF는 다음과 같습니다.

```bash
cd 2-bff-apps/bruno-api-tests
npx -y @usebruno/cli@4.1.0 run --env local
```

`pnpm bruno`는 Bruno 앱을 열 뿐 E2E 실행·통과를 대신하지 않습니다. 테스트 데이터 변경과 정리는 각 컬렉션의 정책을 따릅니다.

### 5. 연결 확인과 문제 해결

```bash
codex mcp list
codex mcp get playwright
codex mcp get chrome-devtools
codex mcp get reason-hwang-storybook
```

설정을 추가한 뒤 Codex 앱/CLI 세션을 다시 열고, CLI에서는 `/mcp`로 실제 연결 상태를 확인합니다. `list`에 enabled로 표시되는 것은 등록 확인이며 연결 성공 검증과는 다릅니다.

- Playwright: `browser_navigate`로 `about:blank`를 열고 `browser_snapshot` 호출을 확인합니다.
- Chrome DevTools: `list_pages`로 격리 브라우저 실행을 확인합니다.
- Storybook: 서버 실행 후 `stories-preview`, `stories-find-by-component`, `test-run` 등 실제 도구 목록을 확인하고 변경한 story를 테스트합니다.
- MCP 도구가 없으면 Codex 세션을 재시작하고 설정 이름·실행 파일 PATH를 확인합니다.
- 최초 다운로드가 느려 시작 시간 제한에 걸리면 각 패키지의 `npx ... --help`를 먼저 실행하고, 필요하면 해당 MCP 설정의 `startup_timeout_sec = 60`을 지정합니다.
- Storybook 연결 거부는 서버 실행 여부와 MCP URL의 포트를 확인합니다. 일반 UI URL이 아닌 `/mcp`를 사용합니다.
- Chrome 실행 실패는 Chrome 설치 위치를 확인합니다. 기본 위치가 아니면 Playwright의 `--executable-path`, Chrome DevTools의 `--executablePath`를 사용합니다.

2026-09-20 설치 검증에서 두 브라우저 MCP의 초기화·도구 목록·브라우저 실행, 별도로 소유한 16006 포트 Storybook MCP의 초기화·도구 목록, Bruno CLI 버전을 확인했습니다. 이는 설치 점검이며 프로젝트 기능 E2E 결과는 아닙니다. 이후 검증 결과는 [flow](docs/flow/)에 기록합니다.

공식 참고: [Playwright MCP](https://github.com/microsoft/playwright-mcp), [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp), [Storybook MCP](https://storybook.js.org/docs/next/ai/mcp/overview/).

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
- `infra/1-infra-graph-rag`의 PostgreSQL 기본 포트는 `55432`이며 `.env`에서 변경할 수 있습니다.
- 빌드 산출물, 캐시, 가상환경, OAuth 토큰은 커밋 대상이 아닙니다.
