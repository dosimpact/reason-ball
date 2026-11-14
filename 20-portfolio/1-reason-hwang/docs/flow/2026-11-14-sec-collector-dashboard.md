# SEC Collector 운영 대시보드

날짜: 2026-11-14. 결정 ID: `SEC-COLLECTOR-001`. 범위: Host `/sec-collector`, 기존 BFF SEC API6개 소비. 기존 flow·human-docs·사전 사용자 변경은 보존한다.

## 합의한 범위

회사·공시 현황과 검색/페이지, 회사 선택에 따른 공시·상세·원문, 회사 동기화, 선택/전체 기업 수집 폼, 요청·응답 확인과 현재 세션 SSE 기록을 제공한다. 수집 기본기간은20년이며 자동 실행하지 않는다. 기존 generic same-origin BFF proxy를 사용하고 BFF API·DB schema는 변경하지 않는다. 영구 작업 이력·자동 재연결·새 상태 API는 범위 밖이다.

## acceptance와 실행 계획

| ID | 시나리오 | 정책 |
| --- | --- | --- |
| SEC-COLLECTOR-BROWSE | 현황·회사 검색/페이지·선택·공시 필터/페이지·상세·원본/수정본·원문, empty/error | VAL-BROWSER-001 |
| SEC-COLLECTOR-RUN | 명시적 회사 동기화와 선택/전체수집, 기본20년·현재 설정·중복실행 방지·요청응답 확인 | VAL-BROWSER-001 |
| SEC-COLLECTOR-SSE | split chunk·heartbeat·progress·completed·partial·HTTP200후error·불완전 종료·취소 | VAL-BROWSER-001 |
| SEC-COLLECTOR-VIEW | loading/empty/error/partial, keyboard·390px·light/dark | VAL-VIEW-001 |
| SEC-COLLECTOR-LIVE | 실제 SEC 단일 회사 짧은 기간만 조회/수집하고 결과 재조회 | VAL-BROWSER-001 |

전체기업20년 수집은 fixture upstream 또는 격리 DB에서만 검증한다. 실제 대량수집은 실행하지 않는다. 브라우저 fixture HTTP 결과와 실제 BFF·SEC 결과를 분리해 기록한다. proxy/API 계약이 변경되면 Bruno API E2E도 추가한다.

## 환경과 자원

소유 fixtureBFF3980, Host3183(`.next-sec-collector-validation`), 필요 시 Storybook6106와 MCP 전용Chrome을 사용한다. 사용자 개발 서버·공유MCP는 유지한다. 종료 시 PID·포트·임시cache 정리를 확인한다.

구현·검증 PASS. 최종 current-state를 관련 stock에 동기화했다.

## 검증 결과

- FE 최종 typecheck·ESLint/Steiger PASS(기존 img warning), transport unit7/7 PASS, Storybook6/6 PASS: overview/detail, selected collection, bulk confirmation, empty, API failure, scope/filter reset.
- Playwright CLI `SEC_LIVE_BASE_URL=http://127.0.0.1:3183 pnpm -C 1-fe-host test:e2e tests/e2e/sec-collector.spec.ts --project=chromium`:3/3 PASS12.1초. 각 테스트는 `/api/remote-proxy/__calls` fixture를 먼저 검사하므로 실제BFF에서 bulk 테스트를 실행하지 않는다. HTML `1-fe-host/playwright-report/`, results `1-fe-host/test-results/`(ignored).
- MCP fixture: 총12회사15공시(완료13/대기1/실패1),10행 page와 별도 전체 count 구분. 기업 next→TEST9→back, AAPL 선택·공시CIKscope·새로고침 선택유지, MSFT변경CIK동기화, 전체reset 확인. 공시상세 original/amendment 분리·연결접수번호 확인, rawdocument 새탭 열기·닫기. empty search와503목록error 후 복구 확인.
- MCP fixture6API 실제HTTP: 회사 동기화201 완료, selected20년과 all20년 명시확인 후 각각completed. 모든20년수집은 메모리fixture만 사용. 13byte split SSE·heartbeat·metadata/documents progress·completed 파싱. PARTIAL→일부실패, HTTP200후ERROR502event→오류, INCOMPLETE terminal없이EOF→연결중단. 실행중 버튼disabled 확인. 검사기에 실제GET/POST args/status/response 표시.
- MCP390px scrollWidth390(Host·Storybook), light/dark 시각 검토, 테이블 내부스크롤과 반응형필터 유지. PNG `.playwright-mcp/sec-collector-{mobile,dark,light}.png` 보존. Storybook overview/detail 실제MCP 열고 렌더링 확인.
- **실제 제한 수집**: 별도 소유 realBFF3981(기존 설정DB, migration4개 이미적용을 read-only확인)로 Hostupstream을 변경. 실제UI에서 AAPL CIK0000320193만 `since:2026-11-01,downloadDocuments:false,refreshArchive:false` 확인 후 정확히1회POST. SEC metadata3건, companiesProcessed1, documents skippedtrue, completed{filingsSynced:3,downloaded:0,failed:0}. 목록 재조회 AAPL275건 확인. 실제회사전체sync·bulk·원문다운로드는 실행하지 않았다. DB metadata 변경은 유지되는 명시적 검증 결과다. PNG `sec-collector-real-aapl.png`. 실제환경 콘솔error0.

서버 API·DB 계약을 수정하지 않았으므로 VAL-API 신규 endpoint 검증은 적용 대상이 아니다. 기존 proxy를 통한 실제HTTP와 브라우저 검증을 수행했다. VAL-VIEW-001·VAL-BROWSER-001 PASS. 실행 결과는 fixture와 실제SEC를 구분한다.

## 정리 확인

VAL-CLEANUP-001 PASS. 소유 fixture3980(PID3358/session31340), Host3183(session26808→31714, 최초PID2320), Storybook6106(session92269)는 Ctrl-C 정상 종료. MCP browser_close로 두 탭과 전용ChromePID4076 종료. `ps -p 3358,4076,2320 -o pid,ppid,state,command` header만, `lsof -nP -iTCP:3183 -iTCP:3980 -iTCP:3981 -iTCP:6106 -sTCP:LISTEN` 결과 없음.

realBFF 담당자는 exact 소유 processgroup2939를 확인한 뒤TERM, PID2939/2948/2970 모두없음과3981포트해제를 확인했다. 로그는 `/var/folders/mt/kwf9rfcx09g46g_8lltsq3100000gn/T/sec-collector-real-bff-07w9xsme/server.log` 보존. 사용자2980·2983서비스와 공유MCP는 종료하지 않았다. 임시 `.next-sec-collector-validation`·자동tsconfiginclude·next-env참조는 제거하고 PNG·report 증거는 보존했다. human-docs·기존flow·사전사용자변경은 수정·stage하지 않는다.
