# OpenUI Query 금융 차트

날짜: 2026-11-14. 범위: 기술적 분석, Host OpenUI, Python 가격 API. 결정 ID: `TA-QUERY-001`.

## 배경과 변경 방향

기존 기술적 분석은 모델 실행 후 OHLCV·지표 배열을 OpenUI 프로그램에 삽입한다. 이번 변경은 최소 요청 설정을 `Query`로 선언하고 기존 Host `/api/langgraph` 프록시를 통해 Python의 Yahoo·TA-Lib 계산 API를 호출한다. 봉·거래량·SMA·RSI·MACD를 Lightweight Charts로 표시하고 화면 설정 변경과 polling은 새 모델 실행 없이 처리한다.

실제 반영 범위는 구현 및 검증 이후 아래 stock에 동기화한다.

- [기술적 분석 비즈니스 설계](../stock/technical-analysis/business-design.md)
- [기술적 분석 시스템 설계](../stock/technical-analysis/system-design.md)
- [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md)
- [공통 실행 경계](../stock/tech-shared/system-design.md)

## 검증 시나리오

| ID | Given / When / Then | 필수 정책 |
| --- | --- | --- |
| TA-QUERY-API | Yahoo ticker와 유효한 설정 / HTTP GET / 완료 OHLCV와 TA-Lib 지표, 출처·통화·기간·조회 시각을 반환하고 날짜가 정렬·일치 | VAL-API-001 |
| TA-QUERY-ERROR | 잘못된 설정 또는 없는 ticker / GET / 명시적 validation·provider 오류, 과거 성공값을 최신값으로 제시하지 않음 | VAL-API-001 |
| TA-QUERY-VALIDATE | 최소 Query 프로그램 / Host validator / unresolved·parse 오류 없이 수락 | VAL-API-001 |
| TA-QUERY-VIEW | 정렬된 fixture / Storybook light·dark·390px / 캔들·거래량·SMA·RSI·MACD 표시, null 준비 구간과 empty·error 처리 | VAL-VIEW-001 |
| TA-QUERY-REACTIVE | 실제 Host 프록시 연결 화면 / ticker·interval·count·기간 변경 / 해당 API 재조회 및 차트 갱신, runs/LLM 요청 없음 | VAL-BROWSER-001 |
| TA-QUERY-LIFECYCLE | 조회 중 또는 polling 중 / 설정 변경·화면 이탈 / 오래된 응답 차단, polling·chart·observer 정리 | VAL-BROWSER-001 |

## 환경 사전 확인

- 사전 변경 `.gitignore`, `AGENTS.md`, 상위 `AGENTS.md`, `docs/human-docs/`의 사용자 변경을 보존한다. `human-docs/`에는 쓰지 않는다.
- Host에 Storybook Vitest browser runner, Playwright CLI와 Playwright MCP가 존재한다. Python에 기존 `bruno-api-tests` 컬렉션이 있다.
- 설치된 OpenUI `react-lang` 1.0.1은 `Renderer.toolProvider`, Query loading/error/retry와 state update 계약을 제공한다. 기존 validator는 parser의 unresolved도 오류로 처리하므로 실제 Query 프로그램 acceptance를 별도 확인한다.
- 기존 사용자 서버·공유 MCP는 유지한다. 새 서버·브라우저의 PID·포트·세션과 종료 증거는 실행 시 추가 기록한다.

## 검증 상태

필수 API·Storybook·MCP 통합 검증 및 정리 PASS. 아래 최종 판정과 실행 증거를 따른다.

## 구현과 실행 증거

- API: 기존 Python Yahoo adapter·캐시·완료 봉 정책·TA-Lib를 재사용하는 `GET /technical-analysis/chart`, FastAPI와 LangGraph custom http.app 양쪽에 등록. 직접 LangGraph runtime3982에서 AAPL60을 실제 조회하여200, 날짜 증가 정렬,11개 열 정렬, histogram=MACD-signal, USD와 기준2026-11-13 확인.
- Bruno: backend 담당자가 소유한3988에서 `20-technical-analysis-chart`를 실제 Yahoo 대상으로 실행.6요청·6tests·6assertions PASS(최종1479ms). AAPL 일봉120, 삼성전자 주봉20/SMA60/KRW, count201·MACD 역전·5m·EMA422 포함. 소유 PID60159 종료 및3988 포트 해제 확인.
- Python: 최종 targeted20 PASS, 확장36 PASS(최종 controls DSL 전), scoped Ruff PASS. snapshot200봉 프로그램60000자 이하 회귀 확인.
- Host: 최종8 Query unit tests PASS(SDK A→B→A key race 포함), Storybook7 PASS(기본·loading·error·empty·price-only·all-null warmup·pending-null), typecheck/lint PASS(기존 img warning). SDK Query parser acceptance 오류·unresolved0; generated schema/prompt 동기화.
- MCP 실제 사용자 흐름: Host3183 `/chat`에서 기술적 분석 에이전트를 선택하고 AAPL 일봉60 RSI14/SMA20/MACD12/26/9를 입력. 실제 모델·Yahoo·TA-Lib·Host validator를 거쳐 분석과19canvas 차트 표시. 이후 ticker MSFT, 주봉,120봉으로 변경하여 API GET100~102의200과 MSFT1wk metadata를 확인. 새 graph run 요청은95 이후 추가되지 않음.
- MCP polling:30초 checkbox를 켠 후 같은 MSFT1wk120 API GET103·107이 추가되며 graph runs 또는 브라우저 모델 provider 요청 없음. 분석 본문과 최초 AAPL 근거 유지, 차트 metadata만 MSFT로 갱신. backend route 자체가 가격/TA-Lib만 호출하며 LLM 의존 없음.
- MCP 오류: INVALID_TICKER_ZZZZZ가 실제 공급자503을 반환하여 명시적 `가격 조회 실패 (503)` alert와 빈 차트를 표시. 기존 성공값을 최신값으로 표시하지 않음. 이후 MSFT로 복구하고 일봉 변경200/19canvas 확인.
- MCP 테마/반응형: Host 다크 토글 이후 dark theme와19canvas 유지.390px에서 document scrollWidth390, chart356px로 수평 overflow 없음. Storybook390px chart358px/19canvas, all-null warmup19canvas와 경고 확인. dark PNG에서 캔들·거래량·SMA20·RSI14·MACD12/26/9·histogram·attribution 시각 확인.
- 발견·수정: Query가 pending 중 null을 넘겨 FinancialChartView가 symbol을 읽을 때 예외 발생. frontend가 null/undefined를 loading snapshot으로 정규화하고 PendingQuery story를 추가. 수정 후 AAPL→잘못된 ticker→MSFT→일봉 변경에서 새 TypeError 없음(예상503 네트워크 오류만 추가). 기존 콘솔 오류는 수정 전 기록으로 보존.
- 초기 실패는 공유 `.next`와 기존2983 Host의 cache 충돌·동시 next.config/env 수정으로 발생. 관련 없는 서버는 유지하고 기존 NEXT_DIST_DIR 지원으로 `.next-ta-query-validation`을 분리한 소유3183에서 재검증. 동시 SEC 제거 작업은 본 변경과 분리해 보존한다.

PNG 증거(로컬 실행 산출물, 커밋 대상 아님): `.playwright-mcp/ta-query-story-mobile.png`, `ta-query-story-dark.png`, `ta-query-chat-dark.png`, `ta-query-chat-mobile.png`. MCP snapshot과 network 요청 기록은 같은 `.playwright-mcp/`에 보존한다.

## 정리 소유 범위

소유 서버: LangGraph3982(session16582, parent57909), Host3183(session31551, 별도 dist), Storybook6106(session87481). 소유 MCP Chrome profile `mcp-chrome-f481857`, parent58152. 공유 MCP 서버와 기존 사용자2983 Host는 유지 대상이다.

새 대화 버튼으로 차트를 제거하여 figure/checkbox/canvas 모두0 확인. 다음 polling 주기 이후 추가 API 요청 없음과 서버·브라우저 종료/포트 해제 결과는 아래 최종 판정에 기록한다.

## 최종 판정과 정리

VAL-API-001, VAL-VIEW-001, VAL-BROWSER-001 PASS. 수정 후 재검증된 null loading·provider 오류·반응형·테마·모델 없는 Query 변경·polling·unmount가 acceptance를 충족한다. 새 대화 후30초 이상 network last request108 유지하여 polling 정지 확인.

VAL-CLEANUP-001 PASS: MCP `browser_close`로 두 소유 탭과 전용 Chrome 종료. Host3183·Storybook6106·LangGraph3982는 소유 tool session에 Ctrl-C로 정상 종료. `ps -p 57909,57932,58025,58042,58043,58152,59274,62957 -o pid,ppid,state,command` 결과 header만 존재. `lsof -nP -iTCP:3982 -iTCP:3183 -iTCP:6106 -sTCP:LISTEN` 결과 없음. backend3988도 담당자의 종료 확인 완료. 공유 MCP와 기존 사용자 서버는 종료하지 않았다.

소유 임시 `.next-ta-query-validation` 및 그 자동 생성 tsconfig include·next-env 참조를 제거했다. PNG·MCP 실행 증거는 보존하며 임시 API JSON은 제거했다. 동시에 수정된 SEC 제거·서버 설정·package scripts·human-docs와 사전 사용자 변경은 본 변경의 commit 대상에서 제외한다.
