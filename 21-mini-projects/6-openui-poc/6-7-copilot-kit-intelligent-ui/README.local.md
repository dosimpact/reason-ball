# Open Intelligent UI 로컬 데모

공식 저장소 https://github.com/CopilotKit/OpenIntelligentUI 의 main 커밋 `8391a94c1c3939c679e40ddd7bfc08a9ef690e70`을 2026-10-20에 가져왔다. 공식 README와 MIT LICENSE는 그대로 보존했다. 기존 goal.md도 보존했다.

## 실행

이 디렉터리는 부모 pnpm 워크스페이스에서 제외한 독립 워크스페이스다. Node.js 22+, Corepack/pnpm 9+, Python 3.12+, uv가 필요하다. Node와 Python 의존성은 설치되어 있다.

```sh
cd 21-mini-projects/6-openui-poc/6-7-copilot-kit-intelligent-ui
pnpm dev
```

http://localhost:3000 에 접속한다. 에이전트는 8123, 선택적 standalone MCP는 3100 포트다. `pnpm dev`는 세 서비스를 함께 시작한다. 종료는 실행 터미널에서 Ctrl+C. 이미 사용 중인 포트가 있으면 해당 소유자를 먼저 확인한다.

프런트와 에이전트만 별도 실행하려면 두 터미널에서 각각 `pnpm dev:app`, `pnpm dev:agent`를 실행한다. `predev`, `predev:app`, `predev:mcp`는 공유 디자인 패키지를 먼저 빌드한다.

## 환경변수와 채팅 인증

- `apps/agent/.env`: 제공받은 OPENAI_API_KEY 저장 완료. TYPESAFE_API_KEY는 비워 두었다. LLM_MODEL=chat-latest, JEV_MODEL=jev-latest.
- `apps/app/.env.local`: LANGGRAPH_DEPLOYMENT_URL=http://localhost:8123.
- 두 서비스의 `.env.example`에는 비밀키 없이 템플릿만 들어 있다.
- 실제 환경 파일은 Git 제외 대상이며 에이전트 .env 권한은 600이다. 키를 README나 로그에 복사하지 않는다.

**현재 공식 버전은 Jev를 필수 시각화 라우터로 사용한다.** 서버는 Jev 키 없이 기동하지만 채팅 요청은 Jev 키가 필요하다. OpenAI 단독 실행 스위치는 없다. 브라우저의 API keys 버튼에서 OpenAI와 Jev 키를 모두 넣고 Test connection, Save keys를 선택한다. 서버 .env에 키가 있어도 공식 UI는 방문자 키를 요구한다. 브라우저 키는 메모리에만 보관되며 새로고침 시 지워진다. 서버 .env는 방문자 키 없는 직접 API 요청에 사용된다.

## 데모 재현

각 항목은 녹화된 화면이 아니라 실제 에이전트 생성이므로 결과가 달라질 수 있다.

1. `Pitch, Roll & Yaw`: 3D 비행기와 회전 제어.
2. 요금제를 표로 비교하도록 요청한 뒤 차트로 바꿔 달라고 요청.
3. `Split the bill fairly`: 총액, 팁, 인원으로 계산하는 도구.
4. `Animate a coastal trip`: 지도와 방문 순서. 지도 타일과 사진은 인터넷 연결 필요.

## 재설치와 검증

```sh
pnpm install --frozen-lockfile
uv sync --frozen --directory apps/agent
pnpm build
pnpm test
uv run --frozen --directory apps/agent pytest -q
curl --fail http://localhost:3000/api/health
curl --fail http://localhost:8123/health
```

검증 결과: [설치 및 검증 기록](docs/flow/2026-10-20-demo-install.md). 현재 설계: [비즈니스](docs/stock/business-design.md), [시스템](docs/stock/system-design.md). 공식 문서 색인은 docs/README.md.
