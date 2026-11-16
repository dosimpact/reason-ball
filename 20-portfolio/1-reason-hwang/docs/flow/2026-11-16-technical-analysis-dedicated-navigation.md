# TA-NAV-001: 기술적 분석 전용 채팅 메뉴

- 날짜: 2026-11-16
- 요청: AI Chat에 인라인·Canvas 기술적 분석 전용 메뉴 추가 및 OpenUI Lang 사용 확인.
- 설계: 기존 LangGraph 개발 채팅 Provider/Page 재사용. `/technical-analysis`는 `technical_analysis_agent`, `/technical-analysis/canvas`는 `technical_analysis_canvas_agent`로 고정. 런타임은 개발 서버이며 history도 runtime·graph 기준을 유지한다.
- 그래프 선택기는 전용 화면에서 표시하지 않고 Provider도 다른 그래프로의 전환을 차단한다. 대상이 미등록이면 오류를 표시하고 다른 그래프로 fallback하거나 실행하지 않는다.
- Given/When/Then: 홈 메뉴 클릭 → 각 전용 경로/그래프만 사용; 질의 → 지정 assistant_id로 실행 및 OpenUI 응답 렌더; 미등록 → 오류 및 실행 없음; 개발 채팅 → 기존 선택기 유지; 모바일 → 헤더 메뉴·Canvas 접근 유지.
- OpenUI 확인: 인라인 workflow의 present → 공유 output graph → presentation.program → InlineAnalysis/OutputView; Canvas compose_canvas → canvas ready program → TaCanvas/OutputView. 두 경로 모두 `@openuidev/react-lang` Renderer·동일 카탈로그 사용. SEC AnswerView도 공유 OutputView 사용. 텍스트 요약과 오류 fallback은 별도이며 매 응답이 DSL이라는 뜻은 아니다.
- 검증 계획: Playwright MCP 탐색·실제 화면 동작, 재현 가능한 route fixture E2E, 변경 파일 ESLint·FSD·typecheck. 실제 시장 데이터/LLM 호출 없이 경계 계약을 확인한다.

## 검증 결과와 한계

- apb-playwright-e2e 스킬로 MCP 실제 접근 이름을 먼저 확인하고 기존 Playwright 설정·스크립트에 회귀 spec 추가.
- VAL-BROWSER-001: 소유 Host `http://127.0.0.1:2993` + 전용 Playwright MCP의 `browser_navigate`/`browser_run_code_unsafe`로 메뉴 클릭 → 고정 페이지 → 인라인/Canvas OpenUI 프로그램 렌더, 미등록 시 실행 0, 목록 복구, 390px 모바일 메뉴→Canvas 접근 PASS. 최종 실행 assistant_id는 인라인/Canvas/Canvas 순서, pageerror 0. 결정적인 HTTP route fixture이며 실제 Yahoo·LLM 품질 검증이 아님.
- `SEC_LIVE_BASE_URL=http://127.0.0.1:2993 pnpm -C 1-fe-host test:e2e --project=chromium tests/e2e/technical-analysis-navigation.spec.ts`: 4 PASS. 직접 진입·새로고침, 지정 assistant_id, 그래프별 history 요청, 미등록/재시도, 개발 채팅 선택기 보존 및 모바일 확인. 보고서 `1-fe-host/playwright-report/`, `1-fe-host/test-results/sec-chat-report.json`.
- 초기 테스트의 Next route announcer 중복 locator는 오류 문구로 범위를 제한. 모바일 메뉴 이동 후 Sidebar가 남던 동작은 링크 선택 시 닫도록 수정. 모바일 검증은 실제 화면 제목이 바뀐 뒤 입력하고 Enter로 전송한다. 개발용 OpenUI Inspect가 390px 화면의 전송 버튼을 가리는 기존 문제는 별도 한계이며 pointer click 통과로 보고하지 않는다.
- MCP 시각 증거 `/tmp/ta-nav-desktop.png`, `/tmp/ta-nav-mobile.png`. 모바일 실제 상하 Canvas와 OpenUI 응답 시각 확인.
- 변경 파일 ESLint PASS. 변경 파일·전이 import를 포함한 `/tmp/ta-nav-typecheck-scoped.json` 기반 `tsc --noEmit` PASS.
- 전체 `pnpm typecheck`는 기존 `.next/types/validator.ts` Route/never 생성 캐시 오류. 생성 캐시 제외 전체 소스 점검의 첫 실행은 PASS였으나 동시 변경 후 재실행은 별도 `tests/sec-modeling/api-testing.test.ts:26`의 implicit any 2건. 기존/동시 변경 파일을 수정하거나 전체 통과로 보고하지 않는다.
- `pnpm -C 1-fe-host test:chat`: 22 PASS/1 FAIL. 기존 native-tools 테스트의 stream 옵션 기대값이 현재 `onDisconnect/onRunCreated` 계약과 다름. 이 작업은 해당 API·테스트를 변경하지 않는다.
- `pnpm -C 1-fe-host lint:fsd`: 별도 SEC collector/modeling의 public API 우회·shared/api 진입 누락 8건. 이번 chat/nav 경로의 오류는 없음.
- VAL-API-001 해당 없음: 서버 API 계약 변경 없음. VAL-VIEW-001 해당 없음: 독립 순수 View 추가/변경 없이 routing·provider 업무 상태·메뉴 전환을 변경하여 MCP/E2E로 검증.

## 자원 정리

- 소유 Host: pnpm PID43173 → Next PID43190 → server PID43212, postcss PID43549, port2993. package dev script·NEXT_DIST_DIR=.next-ta-nav 사용. Ctrl-C 정상 종료 후 전 PID와 listener 부재 확인.
- 전용 MCP PID43509/44660/44960/45608/45798는 각 실행 finally의 browser_close 및 TERM/exit로 정리. 마지막 PID 부재 확인. 공유 MCP·사용자 브라우저는 종료하지 않았다.
- `.next-ta-nav` 삭제, 이번 생성 tsconfig include 제거, next-env의 소유 경로를 실행 전 상태로 복원. 두 파일 git 변경 없음 확인. 서버/DB/원문 수집·실제 LLM 실행 생성 없음.
- Stock: Host 아키텍처 HOST-NAV-001과 OpenUI TA-NAV-001에 전용 경로와 공유 렌더러를 동기화했다. 이번 요청 외 사용자 변경 보존.
