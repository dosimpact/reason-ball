# LOCAL-PORTS-002: 로컬 애플리케이션 포트 프로필

- 날짜: 2026-11-14
- 요청: 여섯 서비스의 실제 `.env`를 BFF 2980/FastAPI 2981/LangGraph dev 2982/Host 2983/Template 2984/Todo 2985로 수정.
- 변경: 다섯 패키지 `.env` 직접 갱신(Host `.env.local`도 우선순위 충돌 방지를 위해 동기화), 예제 환경 파일 동기화. 비밀값·DB·OAuth 설정 보존.
- 연결: FastAPI `dev`/`start`의 SERVER_PORT 연결, Host Next CLI 실행 전 Node 환경 파일 로드, Vite 포트·origin 환경 파일 연결, BFF Remote 대상 환경 변수 연결. Host→FastAPI/BFF, FastAPI→BFF/UI validator 주소 동기화. 루트 dev 실행 범위 유지.
- Stock: [Workspace](../stock/tech-shared/workspace.md#local-ports-002-애플리케이션-포트-프로필), [System design](../stock/tech-shared/system-design.md), [Host](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#local-ports-002-hostremote-환경-설정), [BFF](../stock/tech-shared/2-bff-apps/INDEX.md#local-ports-002-개발-포트-연결), [FastAPI](../stock/tech-shared/3-langgraph-fast/INDEX.md#lg-env-port-001-서버-포트-환경-변수).
- 검증 PASS: FastAPI dev/start와 LangGraph dev의 실제 uv/셸 명령에서 실행 대상만 printf로 대체하여 2981/2982 CLI 인수와 셸 환경 오버라이드 확인. Host의 실제 Node 환경 파일 옵션으로 PORT 2983과 모든 프록시 주소 확인. BFF Remote 설정을 TypeScript transpile 후 평가하여 PORT 2980 및 두 Remote 목적지 확인. 두 Vite resolveConfig로 server/preview 포트·origin·strictPort 확인.
- 정적 검사 PASS: `pnpm -C 1-fe-host typecheck`, `pnpm -C 2-bff-apps lint`, `pnpm -C 2-bff-apps/remotes/template lint`, `pnpm -C 2-bff-apps/remotes/todo lint`.
- 범위: 포트·개발 실행 환경 구성만 변경, API 계약·View·업무 로직 변경 없음. VAL-API-001/VAL-VIEW-001/VAL-BROWSER-001 적용 대상 아님. HTTP·브라우저 통합 기동 검증은 수행하지 않음. 실행 중인 서버는 재시작하지 않음.
- 보안/정리: 여섯 로컬 환경 파일(Host local 포함)이 git ignore 대상임을 확인. 비밀값 출력·커밋 없음. 검증은 서버·브라우저를 생성하지 않고 명령 종료 확인. 사용자 프로세스·human-docs·기존 flow 보존.
