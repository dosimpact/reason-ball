# 2026-10-22 SEC 대화 중심 진입

- 요구사항 SEC-IUI-004: 기업 선택 폼을 먼저 채우는 대신 자유로운 채팅에서 시작한다.
- 맥락: 기존 화면은 기업 검색/공시 준비가 끝나야 질문 입력창을 표시했다.
- 변경: 상시 입력창, 즉시 표시되는 사용자 메시지, 일반 답변, 대화 내 기업 확인, 자동 최신 공시 준비, 후속 질문, 기업 전환, 중단/재시도 및 새 대화.
- 구현: POST `/api/sec-chat/resolve`가 제한된 대화 이력과 서버 공시 문맥을 사용해 답변/기업 확인/공시 분석을 분기한다. 모델의 검색어는 기존 BFF 기업 조회로 확인하며 모델이 CIK를 생성하지 않는다. 공시 분석은 기존 근거 검증과 AG-UI/OpenUI 경로를 유지한다. 기업 전환 시 공시 세션을 교체하고 이전 기업 근거 이력을 전달하지 않는다.
- 제한: 한 번에 한 기업을 분석한다. 복수 기업 요청은 시작할 기업을 되묻는다. 일반 대화는 원문 인용 없는 텍스트이며 기업 사실 분석은 공시를 준비한다. 대화는 아직 새로고침 후 복원되지 않는다.
- 대상 stock: [도메인](../stock/us-corporate-filings/intelligent-ui.md), [호스트](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md), [LangGraph](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md).
- 검증 시나리오: 첫 화면 입력 가능, 인사/개념 질문, 기업 없는 분석 요청, 한국어 기업 질문 → 실제 10-K 답변, 같은 기업 후속 질문, 다른 기업 전환, 애매한 기업 후보 선택, 오류/중단 후 재시도, 새 대화, 모바일 폭.
- 검증 진행 중. 기존 사용자 실행 FE 2800 / Python 8000 / BFF 2801 및 Docker는 유지한다. 작업 검증 브라우저만 정리한다.

## 최종 검증

- Python `pnpm test:sec-chat`: 16 PASS. 기업 조회 결과 검증, 후보/미검색/회사 없는 요청/복수 기업 분기, 입력과 세션 오류 회귀 포함.
- 변경 Python Ruff/Pyright: 0 errors. FE `pnpm typecheck`/`pnpm lint`: PASS, 기존 복사 media.tsx img warning 1건 유지.
- VAL-API-001: Bruno 07~10 `/resolve` 실제 HTTP/provider 4 requests / 4 tests / 4 assertions PASS. 인사, 한국어 Apple 식별, 공백 422, 만료 세션 404. `/tmp/sec-conversation-bruno.json`.
- VAL-VIEW-001: `pnpm test:sec-chat:views` 기존 인용 토글 Storybook 1 PASS. 채팅 컨테이너는 업무 상태/API를 소유하므로 아래 브라우저 검증을 적용했다.
- VAL-BROWSER-001 실제 MCP: “애플은 어떻게 돈을 벌어?” → 자동 최신 동기화/원문 답변 → “그중 서비스 사업…” 후속 답변 → “이번에는 엔비디아…” 새 CIK 0001045810 답변 PASS. Apple 2개 답변과 NVIDIA 1개 답변, 인사 응답 및 새 대화 확인. 모바일 390px 가로 넘침 없음/입력창 표시, 콘솔 오류 0.
- Playwright `SEC_LIVE_BASE_URL=http://127.0.0.1:2800 pnpm test:sec-chat:live --grep 'conversation:' --workers=1`: 4 PASS. 이 네 테스트는 HTTP fixture를 사용해 입력/초기화, 후보 선택 후 원래 질문 유지, 실패 후 재시도, 중단을 검증한다. 실제 provider 결과와 구분한다.
- 기존 10기업/7질문 스펙은 새 채팅 입력 경로로 갱신했다. 이번 변경에서는 10기업 전체 회귀를 재실행하지 않았다. production build도 이번에는 실행하지 않았다.
- 발견/수정: 모델의 `Apple Inc. (AAPL)` 혼합 검색어는 검색 실패했다. 티커 형식 지시와 괄호 티커 정규화를 추가하고 실제 한국어 질문 재검증 PASS. 중단 버튼 DOM이 전송 버튼으로 재사용되며 재전송하던 문제는 독립 key와 기본 이벤트 방지로 수정 후 테스트 PASS.
- 화면 증거: repository `.playwright-mcp/sec-conversation-desktop.png`, `.playwright-mcp/sec-conversation-mobile.png`. UI 자동화 결과: `1-fe-host/playwright-report/index.html`.
- stock 동기화 완료: SEC-IUI-004 도메인, 호스트 흐름, LangGraph `/resolve` 계약. 기존 구현/검증 flow는 보존했다.
- 자원: 기존 사용자 서비스 FE 2800 / Python 8000 / BFF 2801 및 Docker 유지. MCP 새 대화로 검증 공시 세션을 닫고 공식 browser_close로 검증 브라우저를 종료했다. Playwright/Vitest 작업 프로세스는 종료됐다. 실행 중 서비스 유지가 사용자 요청이다.
