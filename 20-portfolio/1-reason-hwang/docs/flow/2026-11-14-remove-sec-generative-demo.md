# OPENUI-SEC-REMOVE-001: SEC Generative UI 데모 제거

- 날짜: 2026-11-14
- 요청: `/a2ui/sec` 관련 FE 및 LangGraph 기능 제거와 해당 변경 커밋. 현재 명칭 변경을 반영하여 `/open-ui/sec`를 제거한다.
- 이유: SEC API Agent와 기업 검색·공시 조회·분석 역할이 겹치는 전용 데모 정리.

## 변경과 보존 범위

- 제거: Next 페이지, 홈 진입 링크, SecPage export, FE sec mode 및 프록시 허용값, Python SEC mode/action과 전용 도메인 모듈, SEC 전용 탐색 controls, 기존 데모 전용 테스트/Bruno 시나리오.
- 유지: Dynamic·Fixed·Catalog, SEC API Agent, SEC Research Chat, BFF 수집·조회, 공유 SecClient·10-K 파싱·보고서 계획/인용 검증, 공통 OpenUI 출력 그래프. `langgraph.json`은 이 데모를 등록하지 않았으므로 변경하지 않음.
- 계약: FE 제거 화면과 sec 프록시는 404. FastAPI generic mode 라우트는 `sec`에 대해 path validation 422. 동적·고정 모드와 SEC Agent 라우트는 유지.
- 사용자/다른 작업의 technical-analysis·financial-chart·환경/설정 변경, human-docs와 기존 flow는 보존하고 커밋에서 제외.

## Stock 동기화

- [공통 OpenUI](../stock/tech-shared/openui-migration.md#openui-sec-remove-001-sec-데모-제거-범위)
- [Host](../stock/tech-shared/1-fe-host/open-ui.md), [LangGraph](../stock/tech-shared/3-langgraph-fast/open-ui.md)
- [SEC 현재 범위](../stock/us-corporate-filings/open-ui-system.md): 이전 전용 데모 요구사항 SEC-OPEN-UI-01~09 폐기.
- 문서 지도와 기존 OpenUI 안내 문서의 링크 라벨도 현재 범위로 동기화.

## 검증 시나리오와 결과

| 검증 | 시나리오/명령 | 결과 |
| --- | --- | --- |
| Python 회귀 | `pnpm -C 3-langgraph-fast test -- tests/test_generative_ui_actions.py tests/test_generative_ui_graph.py tests/test_generative_ui_http.py tests/test_generative_ui_gate.py tests/test_sec_tools.py tests/test_sec_hybrid.py tests/domains/tenk/test_open_ui_report.py` | 41 PASS |
| SSE 클라이언트 | `pnpm -C 1-fe-host test:generative-ui` | 3 PASS |
| VAL-VIEW-001 | `pnpm -C 1-fe-host test:generative-ui:views`, 홈의 남은 링크와 SEC 링크 부재 및 공통 action | Storybook 3 PASS |
| 타입 검사 | `pnpm -C 1-fe-host typecheck` | PASS |
| 변경 파일 lint | `pnpm exec eslint`로 수정한 TS/TSX 7개 파일 지정 | PASS |
| 전체 FE lint | `pnpm -C 1-fe-host lint` | FAIL: 별도 작업의 untracked `financial-query.test.ts`에 FSD public API sidestep 2건. 수정 범위 밖이며 보존. 기존 media img 경고 1건 |
| VAL-API-001 | 실제 FastAPI 2991에 Bruno 09~12: 제거 sec path 422, Fixed/Dynamic/SEC Agent의 body validation 422 | 요청 4/4·tests 4/4·assertions 4/4 PASS |
| VAL-BROWSER-001 | 별도 Playwright MCP에서 Home SEC 링크 부재, `/open-ui/sec`·`/a2ui/sec`의 HTTP/화면 404, `/sec-api-agent` 입력·starter·환영 화면 | PASS |
| 문서·diff | 관련 링크 및 scoped `git diff --check` | PASS |

API 명령: 컬렉션 `3-langgraph-fast/bruno-api-tests`에서 `pnpm exec bru run 18-generative-ui/09-reject-removed-sec.bru 18-generative-ui/10-retained-fixed.bru 18-generative-ui/11-retained-dynamic.bru 18-generative-ui/12-retained-sec-agent.bru --env openui-validation --env-var baseUrl=http://127.0.0.1:2991`.
실제 앱을 `--lifespan off`로 실행하여 DB 초기화/마이그레이션을 피했고, 제거·라우팅 validation을 HTTP로 검증했다. 실모델 보고서 생성은 이번 검증 범위가 아니며 공유 도구·보고서 동작은 위 회귀 테스트로 확인했다.

브라우저는 in-app Browser 연결 불가와 공유 MCP 프로필 사용 중 오류로 별도 `@playwright/mcp --isolated --headless` stdio MCP를 사용했다. 도구는 browser_navigate/snapshot/click/evaluate/wait_for/console_messages/close다. 새 기능 실행이나 숨겨진 앱 함수를 직접 호출하지 않았다.
증거: `.playwright-mcp/page-2026-11-14T11-01-38-451Z.yml`(홈), `page-2026-11-14T11-03-57-081Z.yml`, `page-2026-11-14T11-03-57-953Z.yml`(404), `page-2026-11-14T11-04-12-612Z.yml`(SEC Agent). 404 페이지의 예상 오류와 favicon 404 외에 최종 SEC Agent 콘솔 오류 없음.

초기 재시도: 보고서 테스트 경로 오기재 후 올바른 경로로 41개 재실행 PASS. 정적 표준 OpenAPI에 프로젝트 라우트가 포함되지 않아 schema 방식 검증을 실제 route/body validation으로 교체 후 4/4 PASS. 개발 서버의 동시 설정 변경/재시작 중 초기 브라우저 연결·Dynamic 이동 대기 실패 후, 안정화된 서버에서 제거 화면·보존 Agent 검증 PASS. 마지막 추가 Host 프록시 HTTP 요청은 서버 종료와 겹쳐 중단되었으며 PASS로 집계하지 않는다. 프록시 허용값 제거는 변경 파일 검사로 확인.

## VAL-CLEANUP-001

- 작업용 서버: FastAPI PID 59018/59027, Host PID 59060/59077 및 재시작 자식 59094/62955/66372, 포트 2991/2993. Ctrl+C 정상 종료 후 해당 PID와 포트 listener 부재 확인.
- 별도 MCP PID 61286/63045/63888/64319/68921: 각 시도에서 browser_close 후 소유 MCP 프로세스 정상 종료 확인. 기존 공유 MCP·사용자 브라우저는 종료하지 않음.
- 임시 `.next-sec-demo-removal` 삭제 및 tsconfig의 해당 include만 제거. 동시 작업의 `.next-ta-query-validation` 등은 보존. 검증 증거 파일은 유지.
- 비밀 정보/환경 파일/빌드 출력은 커밋하지 않음.
