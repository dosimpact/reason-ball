# LG-ENV-PORT-001: LangGraph 개발 포트 환경 변수 연결

- 날짜: 2026-11-14
- 범위: tech-shared / 3-langgraph-fast
- 변경: `.env`와 `.env.example`에 `LANGGRAPH_PORT=2025` 추가. `dev:langgraph`는 uv의 `--env-file .env`를 통해 로드한 값을 셸에서 확장하여 CLI `--port`에 전달한다. 미설정 기본값 2025, 셸 환경 변수 우선, 추가 CLI 인수 전달 유지. 기존 사용자 지정 포트 2025를 보존한다.
- 이유: LangGraph CLI 포트 옵션을 환경 변수로 제어하기 위한 실행 스크립트 연결. `SERVER_PORT`와 `langgraph.json`은 동작 변경 없음.
- Stock: [패키지 포트 계약](../stock/tech-shared/3-langgraph-fast/INDEX.md#lg-env-port-001-서버-포트-환경-변수) 갱신.
- 검증 PASS: 두 환경 파일의 선언 1회 확인, 실제 uv/셸 호출의 실행 명령만 printf로 대체하여 `.env` 값 2025와 셸 오버라이드 2030의 CLI 전달 확인. `pnpm -C 3-langgraph-fast dev:langgraph --help` 성공으로 CLI 인수 전달 확인. `git diff --check` 수행.
- 적용: 서버 실행 옵션만 변경, API 계약·View·비즈니스 로직 변경 없음. VAL-API-001/VAL-VIEW-001/VAL-BROWSER-001 적용 대상 아님.
- 정리: 서버·브라우저·임시 자원 생성 없음. 검증 명령 종료 확인, 기존 사용자 자원 유지.
