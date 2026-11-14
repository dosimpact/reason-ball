# SEC Collector API Testing 탭

날짜: 2026-11-14. 결정 ID: `SEC-COLLECTOR-002`. 기존 운영 화면과6개 BFF API를 유지하고 Postman/Bruno 형태의 수동 검사 탭을 추가한다. 이전 flow·human-docs·사전 사용자 변경은 보존한다.

## 합의 범위와 acceptance

고정 method/path를 가진6개 preset만 기존 same-origin proxy로 호출한다. query/path/raw JSON을 편집하며 JSON 문법은 검사하되 서버 업무 schema 오류는 원문 그대로 전송해 실제400을 표시한다. 임의URL·method는 허용하지 않는다. HTTP status/headers/elapsed·JSON/text·SSE events와 실제 요청/응답 복사를 제공한다. raw HTML은 텍스트로 표시한다.

탭 전환만으로 호출하지 않는다. 운영/Testing 공유 실행 lock으로 동시 mutation을 막으며 stream과 세션 기록은 탭 전환에 유지된다. 전체수집은 명시적 확인 뒤 실행하고 transport중단을 서버 작업취소로 표시하지 않는다.

검증: Storybook, allowlist/parser/abort/error unit, MCP fixture 모든6preset·잘못된schema400도착·JSONlocal오류·HTTP/network/streamterminal구분·중복/탭전환·copy·rawHTML·390px/light/dark. 전체20년은 fixture에서만 호출한다. 실제BFF는 bounded read만 수행하며 새DB쓰기 없음. API route가 바뀌면 Bruno E2E 추가.

관련stock [운영화면 설계](../stock/us-corporate-filings/collector-dashboard.md). 소유fixture3980·Host3183(`.next-sec-api-testing-validation`)·Storybook6106·전용MCPChrome만 생성/정리, 사용자서비스와 공유MCP 유지.

구현·필수 검증 PASS. stock의 SEC-COLLECTOR-002에 최종계약을 동기화했다.

## 실행 검증

- unit11/11 PASS: exact allowlist·원문JSON 보존·실제400·nonJSON·splitSSE/partial/error/EOF·abort·network·표시상한·expectedSSE200JSON/204 비성공. Storybook10/10 PASS(기존6+API4), lint/Steiger PASS(기존imgwarning), 최종 typecheck재실행PASS. 동시 sec-modeling story 오류는 소유자가 해결했으며 본 작업에서 수정하지 않았다.
- PlaywrightCLI `SEC_LIVE_BASE_URL=http://127.0.0.1:3183 pnpm -C 1-fe-host test:e2e tests/e2e/sec-collector.spec.ts --project=chromium`:5/5 PASS19.5초. 기존운영3+신규API2(invalidschema400/rawHTML비실행, SSE탭유지공유lock/abort). fixture안전확인 후만 bulk실행. ignored HTML/report는 기존경로에 보존.
- MCP 실제fixtureHTTP: 탭전환 전후 API호출7→7로 자동요청없음.6preset 모두실행(기업목록/공시목록/rawcontent/회사sync201/selectedSSE/allSSE). all20년은메모리fixture에서만확인후실행. schema-invalid `years:"invalid"`가같은body로서버도착하고400message표시; malformedJSON은Senddisabled. HTMLscript문자열표시·window실행flag없음. plain502text HTTP오류와 controlled routeabort network오류를구분. split13byte·한국어UTF8·heartbeat 및completed/partial/error/EOF처리. copy201response와 실제AAPLrequest를검증,editorMSFT변경후에도AAPL전송snapshot복사.
- SLOW SSE started후운영탭에서syncdisabled, Testing복귀started보존. 연결중단후HTTP200/headers/started이력과요청중단상태유지,lock해제. 서버취소로표시하지않음.
- MCP390px scrollWidth390,light/dark 시각검토PASS. PNG `.playwright-mcp/sec-api-testing-{mobile,light,dark}.png` 보존. Storybook API-request-and-server-error 실제MCP열어400상태/본문렌더링확인.
- **실제BFF read-only**: 별도소유3981의 기존localDB·migration4개적용상태를read-only확인. TestingUI GETcompanies?page1&pageSize1&tickerAAPL→HTTP200 AppleCIK0000320193,total1,headers/elapsed확인. 실제POST·DB쓰기·SEC대량수집없음. PNG `sec-api-testing-real-get.png`.

새API route/DB계약은없어 VAL-API신규endpoint검증대상이아니다. 기존proxyHTTP와브라우저를검증했다. VAL-VIEW-001·VAL-BROWSER-001 PASS. 사용자서비스·human-docs·과거flow와동시SEC모델링변경은보존한다.

## 정리

VAL-CLEANUP-001 PASS. 소유Host3183(session19807→38475,최종PID15941),fixture3980(session11739,PID12787),Storybook6106(session68325,PID14979)는Ctrl-C정상종료. MCPbrowser_close로두탭·전용ChromePID12989종료. `ps -p 12787,14979,15941,12989 -o pid,ppid,state,command` header만, `lsof -nP -iTCP:3183 -iTCP:3980 -iTCP:3981 -iTCP:6106 -sTCP:LISTEN` 없음.

realBFF소유group13226은담당자가exact명령확인후TERM,PID13226/13252/17378없음과3981해제확인. log `/var/folders/mt/kwf9rfcx09g46g_8lltsq3100000gn/T/sec-api-testing-real-bff-rxik8yy0/server.log`보존. 임시dist·자동tsconfiginclude·next-env참조제거. 사용자2980/2983·공유MCP·동시모델링작업·PNG/report증거보존.
