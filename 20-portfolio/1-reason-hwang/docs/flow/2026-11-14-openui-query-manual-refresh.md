# OpenUI Query 수동 새로고침

날짜: 2026-11-14. 결정 ID: `TA-QUERY-002`. 이전 [TA-QUERY-001 기록](2026-11-14-openui-query-financial-charts.md)은 보존한다.

## 요청과 설계

Query 지원 차트에서 ticker·주기·봉 수를 편집하고 새로고침 아이콘으로 현재 설정을 다시 조회한다. 같은 설정이어도 네트워크 재조회가 발생하며 새 모델 실행은 만들지 않는다. loading 중 중복 실행을 막고 접근 가능한 아이콘 이름과 상태를 제공한다. 기존 분석 스냅샷·polling·이전 답변 수명 정책을 유지한다.

반영 대상: [비즈니스 설계](../stock/technical-analysis/business-design.md), [시스템 설계](../stock/technical-analysis/system-design.md), [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md).

## acceptance와 검증 계획

| ID | 사용자 행동과 예상 결과 | 정책 |
| --- | --- | --- |
| TA-QUERY-REFRESH | 같은 인자에서 아이콘 클릭 → chart GET1건 추가, runs/provider 요청 없음 | VAL-BROWSER-001 |
| TA-QUERY-PENDING | 느린 응답 중 연속 클릭 → 버튼 disabled/loading, 중복 조회 없음 | VAL-VIEW-001, VAL-BROWSER-001 |
| TA-QUERY-ARGS | ticker/주기/봉 수 편집 후 클릭 → 현재 인자로 조회·metadata 갱신 | VAL-BROWSER-001 |
| TA-QUERY-RECOVER | 잘못된 ticker 오류 후 수정·다시 클릭 → 오류 표시 후 정상 차트 복구 | VAL-BROWSER-001 |
| TA-QUERY-LAYOUT | light/dark·390px에서 인자와 아이콘 → 접근 가능한 이름·상태, overflow 없음 | VAL-VIEW-001 |
| TA-QUERY-LIFECYCLE | opt-in polling·이전 답변·새 대화 → 기존 정책 유지, unmount 후 요청 없음 | VAL-BROWSER-001 |

## 사전 상태와 소유 범위

`.gitignore`, `tsconfig.json`, `AGENTS.md`, 상위 `AGENTS.md`, 모든 human-docs의 기존·동시 사용자 변경을 보존한다. human-docs에는 쓰지 않는다. 사용자 개발 서버는 유지하며 별도 dist의 소유 Host3183, runtime3982, Storybook6106와 MCP 전용 브라우저만 생성·정리한다.

구현·필수 검증 PASS. stock은 최종 QueryPanel/native @Run 계약에 동기화했다.

## 실행 검증

- Python: presentation grouping 회귀17 tests PASS, scoped Ruff·diff checks PASS.
- FE: QueryPanel의 실제 Renderer Storybook2/2 PASS(`openui-querypanel--refresh-and-arguments`, `openui-querypanel--error-recovery`), Query unit8/8 PASS, typecheck/lint PASS. `@Run(chart)` parser/catalog 검증 PASS. backend 변경은 DSL grouping이며 가격 API 계약은 변경하지 않는다.
- MCP 실제 `/chat` 사용자 흐름: owned Host3183 → runtime3982 → 실제 Yahoo·TA-Lib·모델 분석과 검증을 통해 AAPL 일봉60봉 출력. 최초 chart GET137 이후 같은 인자 새로고침 클릭GET138만 추가200. 마지막 모델 run135 이후 수동·인자 변경 동안 새 run/provider 요청 없음.
- ticker MSFT·주봉·120봉 편집GET139~141 모두200, 현재 인자 새로고침GET142200. metadata는 MSFT1wk, 최초 분석 본문은 AAPL 스냅샷 유지.
- 잘못된 ticker GET143503과 수동 재시도GET144503에서 오류 alert 확인. AAPL 수정GET145200 후 같은 인자 새로고침GET146200으로 복구. 콘솔은 예상503 네트워크 오류2개이며 렌더링 예외 없음.
- MCP Storybook 지연200ms fixture: 수동 새로고침 직후 button disabled=true, panel aria-busy=true 확인. pending 중 추가 DOM click도 호출 수가5→6으로 정확히1만 증가. 조회 완료 후 enabled 복구. fixture는 실제 Yahoo 연동 결과와 구분한다.
- mobile390px document scrollWidth390·panel356px, dark theme에서 ticker·주기·봉 수·아이콘 함께 배치, 차트와 attribution 시각 확인. `.playwright-mcp/ta-query-refresh-panel-dark.png`, `ta-query-refresh-mobile.png`, `ta-query-refresh-story-mobile.png`에 PNG 보존(ignored 실행 산출물).

## 자원 소유

LangGraph3982(session72301, PID77596/77598), Host3183(session26161, PID77628, `.next-ta-refresh-validation`), Storybook6106(session55346), MCP ChromePID77661(profile mcp-chrome-f481857). 사용자 개발 서비스와 공유 MCP는 유지한다. 정리 증거는 검증 종료 후 추가한다.

- polling 회귀: opt-in30초를 켜고 동일 AAPL1wk120 GET147200 추가 확인. 새 대화에서 panel/canvas/refresh 모두0 확인. native QueryPanel은 polling 설정·active 정책을 변경하지 않고 기존 출력 provider를 재사용한다.

## 최종 판정과 정리

VAL-VIEW-001·VAL-BROWSER-001 PASS. 가격 HTTP API 계약은 변경하지 않았으며 native Query 실행을 기존 실제 API 경로로 검증했다. 새 대화 후30초 이상 요청147 이후 추가 chart 요청 없음 확인. 이전 polling·snapshot 수명 정책 유지.

VAL-CLEANUP-001 PASS: 소유 Host3183·Storybook6106·runtime3982 tool sessions에 Ctrl-C로 정상 종료하고 MCP browser_close로 두 탭과 전용 Chrome 종료. `ps -p 77596,77598,77628,77661,78284 -o pid,ppid,state,command`는 header만, `lsof -nP -iTCP:3982 -iTCP:3183 -iTCP:6106 -sTCP:LISTEN` 결과 없음. `.next-ta-refresh-validation`과 자동 tsconfig include/next-env 참조를 제거하고 실행 PNG·MCP 증거는 보존했다. 사용자 개발 서버와 공유 MCP는 유지했다. 이전 flow·human-docs·사전 사용자 변경은 수정하지 않았다.
