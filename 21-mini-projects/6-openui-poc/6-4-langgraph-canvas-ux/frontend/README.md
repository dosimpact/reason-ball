# OpenUI Dynamic Canvas frontend

Node.js 20.9+ 및 npm을 사용하는 독립 Next.js 프로젝트다. 설치·빌드에 Python이 필요하지 않다.

```bash
npm ci
npm run generate
npm run generate:canvas
# 최초 설정 시에만 cp .env.example .env
npm run dev
```

UI는 http://127.0.0.1:3045 이며 `LANGGRAPH_API_URL` 기본값은 `http://127.0.0.1:2037`이다. OPENAI_API_KEY는 Python 프로젝트에만 둔다. `/`는 Canvas workspace, `/chat`은 기존 전체 AgentInterface다. `/gallery`와 `/preview`는 기존 개발 전용 UI 예제다.

- `src/canvas/model.ts`: 문서/위젯 schema, 순수 상태 명령, 호환성 검증
- `store.ts`: 브라우저 저장과 모델 없는 데이터 갱신
- `render.tsx`: 전체 카탈로그 + host snapshot을 읽는 CanvasData
- `stream.ts`: 채널별 SSE 수신과 중복/취소 처리
- `workspace.tsx`: Chat, 탭, drag/drop/resize, 생성·수정·실패 UX
- `/api/workspace`, `/api/data`: Python Canvas API 프록시
- `/api/chat`: 기존 protocol v2/AG-UI 프록시

## 검증

```bash
npm test
npm run lint
npm run typecheck
npm run verify
```

두 서버를 실행한 뒤:

```bash
npm run test:smoke
npm run test:browser
npm run test:browser:interactions
npm run test:browser:context       # 중복 제목·없는 대상 확인
npm run test:browser:ux
```

smoke와 live/interactions는 실제 모델을 호출한다. UX suite는 합성 fixture와 일부 주입한 응답을 사용하며 실제 SQL refresh도 수행한다. fixture와 correction 준비에는 형제 Python 프로젝트의 개발용 CLI를 실행하므로 이 브라우저 테스트 명령에만 Python/uv가 필요하다. 앱 런타임은 HTTP만 사용한다.

`tests/mcp-check.mjs`는 고정된 `@playwright/mcp` 서버를 MCP SDK로 연결한다. Chrome을 headless/isolated로 열고 browser_navigate, browser_run_code_unsafe, snapshot, screenshot 도구를 호출한다. 성공/실패 모두 finally에서 browser_close와 transport 종료를 수행한다. 로그는 `output/playwright/browser-*.json`, 스크린샷은 같은 디렉터리다. 사용자의 기존 Chrome 세션은 건드리지 않는다.

## 카탈로그 변경

`npm run generate`는 기존 라이브러리, `generate:canvas`는 Canvas 확장 라이브러리의 프롬프트와 schema를 `src/generated`에 생성한다. 생성물은 Git 제외이므로 새 설치 후 실행한다. 계약을 바꾼 경우 대응 프롬프트를 Python의 `agent` 자산으로 복사하고 통합 검증한다.

localStorage는 Canvas와 Chat의 저장소다. 모델 출력이 잘못되면 완료로 적용하지 않는다. 미지원 Canvas 문서는 원본 다운로드/백업과 마지막 snapshot 표를 제공한다. 자세한 계약과 한계는 [시스템 설계](../docs/stock/system.md), 검증은 [flow](../docs/flow/2026-10-18-canvas-implementation.md)에 있다.
