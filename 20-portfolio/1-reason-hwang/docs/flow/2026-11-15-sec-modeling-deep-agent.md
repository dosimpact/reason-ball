# SEC 모델링 테스트 Deep Agent POC — 2026-11-15

## 맥락과 결정

- SEC-AGENT-001: 사용자가 기술적 분석 에이전트와 같은 deepagents 기반 POC를 요청했다.
- Host `/chat`에서 테스트하며 LangGraph dev OSS API로 검증한다. 브라우저 검증은 사용자 지시로 제외한다.
- sol 서브에이전트 3개가 그래프, 도구, 검증을 분담했고 주 에이전트가 BFF·Host 연결과 통합을 담당했다.
- 현재 설계: [SEC 모델링 stock](../stock/us-corporate-filings/sec-modeling.md#sec-agent-001-모델링-테스트-deep-agent-poc).

## 구현

- `sec_modeling_agent` 그래프 등록, 공유 모델 팩토리와 DeepAgentState 재사용, 이전 presentation 초기화.
- 12개 업무 도구: 회사·공시 탐색, 게시 상태·결과, 근거 검색, 실행 이력과 실행·취소·재시도.
- 실행 관리는 BFF 영속 작업으로 한정하고 단순 조회 중 재처리하지 않도록 프롬프트에 명시했다.
- BFF의 공시별 정확한 게시 상태 GET 경로 추가, 공용 HTTP 클라이언트에서 202 접수 응답 지원.
- Host 그래프 이름/채팅 모드/values 스트림 연결. UI 컴포넌트는 추가하지 않았다.
- 실행 요청에 따른 분기 동작은 POC LLM 지침이다. 별도 사용자 승인 엔진을 구현했다는 뜻은 아니다.

## 검증

- `pnpm -C 3-langgraph-fast test:sec-modeling-agent`: 7 PASS. 근거 보존, 빈 게시 결과, 잘못된 식별자·단계,
  오류 비밀정보 제거, model3 고정 모델·접수 결과, native messages/presentation 상태 계약, HTTP 202 접수 처리.
- 실제 LangGraph dev OSS: discovery/schema → thread → runs/stream → state PASS.
  실제 AAPL 최신 10-K에 회사·공시 탐색, 모델1 결과, 모델2 검색, 모델3 사실 조회를 호출했다.
  5개 도구 응답 성공, 변경 도구 호출 0, 6개 스트림 프레임, 최종 응답에 실제 근거 식별자·기간·단위·차원 포함.
- 실제 BFF 세 공시 상태/모델3 결과 조회 PASS: AAPL 8, CPNG 16, NVDA 5개 선별 사실. 잘못된 CIK는 400.
- `pnpm -C 2-bff-apps lint`: PASS. `pnpm -C 1-fe-host typecheck`: PASS.
- `pnpm -C 1-fe-host test:chat`: 23 PASS. 변경한 Python 도구·그래프·테스트·검증 스크립트 Ruff PASS.
- 실제 실행·취소·재시도는 재처리 비용과 기존 데이터 변경을 피하기 위해 실행하지 않았다. 접수 계약은 mock으로 확인했다.
- VAL-BROWSER-001: 사용자 명시 지시에 따라 제외. 브라우저·Storybook을 실행하지 않았다.
- 증거: `3-langgraph-fast/.tmp/sec-modeling-agent-validation/{report,stream,state,bff-read-audit}.json`, `server.log`.

- VAL-API-001 Bruno: 신규 BFF 상태 경로 AAPL·CPNG·NVDA 200, 잘못된 CIK 400. 4 requests / 4 tests / 4 assertions PASS.
  `pnpm -C 3-langgraph-fast test:sec-modeling-agent:api`로 재실행한다. 증거: `.tmp/sec-modeling-agent-bruno-status.json`.
- Host `/api/langgraph-runtime/assistants/search`에서도 신규 그래프 등록을 HTTP로 확인했다.

## 자원 정리 및 서비스

- VAL-CLEANUP-001: 검증용 OSS 서버 PID 30479 / 포트 32982, 생성한 스레드를 삭제하고 서버 종료·포트 반환 확인.
- 사용자 테스트용 기존 LangGraph 2982는 시작 시 그래프 목록을 유지해 신규 그래프를 찾지 못했다.
  정확한 프로젝트 cwd·명령·부모 프로세스를 확인하고 기존 CLI PID 27206을 TERM한 뒤
  커밋된 `pnpm dev:langgraph`로 다시 시작했다(launcher PID 31930).
- 2982의 `/assistants/search`에서 `sec_modeling_agent` 등록을 확인했다. 이 서버는 사용자 `/chat`용으로 유지한다.
- 재시작 로그: `.tmp/service-restarts/langgraph-sec-modeling-agent.log`. 다른 개발 서버는 종료하지 않았다.
- 기존 사용자 staged 삭제·별도 collector/runtime/ixbrl 변경은 보존하며 이번 커밋에 섞지 않는다.
