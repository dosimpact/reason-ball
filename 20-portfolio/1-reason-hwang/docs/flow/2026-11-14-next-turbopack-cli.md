# Host 표준 Next CLI와 Turbopack 실행

- 날짜: 2026-11-14
- 결정: HOST-DEV-CLI-001
- 요청: Node 환경파일 wrapper 대신 Next CLI로 개발 서버를 실행하고, 삭제한 .env.local을 재생성하지 않는다.
- 변경: Host dev는 `next dev --turbopack --hostname 127.0.0.1 --port 2983`, start는 `next start --port 2983`이다. 앱 환경변수는 Next의 표준 로딩을 사용한다. 현재 로컬 파일은 .env만 있다.
- Next CLI는 서버 포트를 .env에서 읽기 전에 시작하므로 스크립트의 `--port 2983`으로 프로젝트 포트를 유지한다. `pnpm dev --port 3280`처럼 마지막 CLI 옵션으로 덮어쓸 수 있다. CLI 옵션은 셸 PORT보다 우선한다.
- next.config.ts: Turbopack root와 outputFileTracingRoot를 독립 workspace인 1-reason-hwang으로 명시해 상위 lockfile 오인을 피한다. NEXT_DIST_DIR 기반 검증 출력 격리, 기존 build/lint 정책은 유지한다.
- 출처: [Next CLI 포트](https://nextjs.org/docs/app/api-reference/cli/next#changing-the-default-port), [Next 15 Turbopack](https://nextjs.org/docs/15/app/api-reference/turbopack).
- stock: [Workspace 포트 계약](../stock/tech-shared/workspace.md#local-ports-002-애플리케이션-포트-프로필), [Host 환경 설정](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#local-ports-002-hostremote-환경-설정).

## 검증

- 설치된 Next15.5.25의 `next dev --help`에서 --turbopack 및 --port 지원 확인.
- `NEXT_DIST_DIR=.next-turbopack-validation pnpm -C 1-fe-host dev --port 3280` 정상 시작. 배너 `(Turbopack)`, Environments `.env`, port3280, Ready802ms 확인. .env.local 미생성.
- MCP Chromium에서 /chat, /sec-chat, /sec-api-agent, /open-ui/dynamic을 실제 로드해 각 page 공통 frame1개와 visible Composer 확인. 네 경로 HTTP200 및 컴파일 성공. console 오류는 기존 favicon404만 관찰했다.
- `pnpm -C 1-fe-host exec eslint next.config.ts`: PASS. 실제 CLI가 Next TS config를 로드하고 컴파일했다.
- 응답 생성/외부 모델 호출·업무 로직 변경 없음. 이 검증은 dev CLI·Turbopack 페이지 로드에 한정한다. production build/start는 실행하지 않았다.

## 자원 정리와 변경 보존

- 검증 서버3280 PID62948: 세션 종료 신호 후 ps/lsof 잔존 없음 확인.
- 공식 browser_close 후 작업 Chrome 프로필 프로세스 잔존 없음 확인. 기존 서비스와 공유 MCP 유지.
- `.next-turbopack-validation` 출력과 해당 tsconfig include만 제거했다. 기존 사용자 next-env/tsconfig의 다른 validation 경로는 유지했다.
- 사용자 작업 중인 lightweight-charts 의존성·기능 변경·환경파일 삭제·human-docs·AGENTS 변경을 보존한다. package.json은 dev/start 두 스크립트만 별도 stage한다. .env.local은 재생성하지 않았다.
