# SEC-REFRESH-DEFAULT-001: SEC Intelligent UI 저장 공시 우선

- 날짜: 2026-11-16
- 요청: 기본 흐름 refresh=false.
- 변경: FE prepare의 hardcoded true를 resolve refresh boolean 전달로 변경. 서버 PrepareRequest/FilingSourceClient/ConversationIntent 기본false, intent prompt의 새 기업 자동동기화 지시 제거. 명시적 true는 유지. 저장 원문 미수집 시 자동수집하지 않음.
- Stock: [Host](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md), [LangGraph](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md) 동기화.
- 검증 계획: 기본 생략false·명시적true Python/API fixture Bruno, FE choose→prepare false와 명시true E2E, MCP 화면. 기존 장기 원문수집 PID93407/BFF는 유지.

## 검증 결과

- VAL-API-001: 실제 SEC router + 외부 SEC/LLM 경계 fixture HTTP, Bruno `tests/bruno-sec-prepare-refresh/`: 요청·테스트·assertion 각각 2/2 PASS. refresh 생략=false, 명시 true 전달 검증. pytest 세 파일 41/41 PASS.
- FE typecheck 및 변경 파일 ESLint PASS. Playwright conversation 전체 7 PASS / 1 FAIL: 기존 `working timeline stays inside the pending assistant turn`의 pending timeline 미표시. 이번 기본값 변경과 별개인 동시 수정 영역이며 전체 회귀 통과로 보고하지 않는다. 변경 시나리오만 재실행한 `company clarification|explicit refresh`는 2/2 PASS.
- VAL-BROWSER-001: 전용 Playwright MCP `browser_navigate` + `browser_run_code_unsafe`, `http://127.0.0.1:2993/sec-chat`. 통제된 HTTP 응답으로 사용자 입력/전송 → prepare `{cik:"0000320193",refresh:false}` 확인 → 409 저장 원문 없음 안내 확인. pageerror 없음; 콘솔의 409 리소스 오류는 의도한 실패 응답. 실제 SEC 다운로드나 LLM 품질 검증을 의미하지 않는다.
- VAL-VIEW-001: 독립 View 변경 없음. 기존 요청 상태 문구와 요청 기본값 분기 변경에 브라우저 검증 적용.

## 자원 정리

- 소유 Host: pnpm PID5007 → Next PID5024 → server PID5030, port2993, 별도 `.next-refresh-false`. TERM 종료 후 해당 PID/자식 PID6007 및 listener 부재 확인. 생성한 build 디렉터리·Next 생성 타입 참조·tsconfig include 정리.
- 소유 MCP PID7457: `browser_close` 후 전용 서버 TERM, exit 및 PID 부재 확인. 공유 MCP와 사용자 브라우저 유지.
- 소유 API fixture PID5069/port29651 정상 종료 후 부재 확인. 기존 BFF 및 장기 수집 PID93407 유지 확인.
- 남은 사항: 별도 진행 중인 timeline 표시 변경의 기존 E2E 1건 실패. refresh 변경 필수 시나리오는 PASS.
