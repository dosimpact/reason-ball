# SEC 확정 기업 공시 수집의 모델 의존 제거

- 날짜: 2026-11-17
- 결정 ID: SEC-COLLECT-002 (기존 SEC-COLLECT-CHAT-001 연계)
- 범위: Python SEC Research Chat의 선택 기업 수집 실행·오류 전달.
- 상태: 구현·필수 API/MCP·회귀·scoped 정적 검사·소유 자원 정리 완료.

## 맥락과 확인한 결함

사용자가 `NVIDIA CORP · 공시 수집 / 서비스 요청 / 실패`를 보고했다. 최근 `/collect`는 SSE HTTP200/약2.0초 뒤 실패 설명으로 이어졌으나 당시 수집 예외를 기록하지 않아 그 단일 실패의 직접 원인을 소급 확정할 수는 없다. 수정 전 실제 NVIDIA2년 수집을 직접 실행했을 때에는 메타데이터31건·새 다운로드0건·실패0건으로 완료됐다.

코드에서는 이미 확정된 CIK·기간의 수집까지 모델 ToolNode 루프에 맡기고 있었다. 모델이 도구 없이 응답하거나 인자를 바꾸거나 반복 호출하면 선택 수집 완료를 확인할 수 없었다. 완료 이후에도 불필요한 모델 응답을 기다려야 했다. 준비 단계에서 제거한 것과 같은 불필요한 모델 선택 의존을 확정 수집 실행에서도 제거한다. 실제 수집 장애를 숨기거나 결과를 만들어내는 수정은 아니다.

## 변경과 이유

- `domains/sec_tools/collection.py`: 확인된 SelectedSyncInput을 만들고 실제 기존 `sync_sec_company_filings` StructuredTool을 한 번 호출한다. 요청 CIK·years/since·downloadDocuments=true·refreshArchive=false·tickers[]를 고정하고 scope/required args 검사를 유지한다. model 인자는 사용하지 않는다.
- 기존 `agent.collect_company_filings` 공개 import 경로는 유지한다. 기업 해석/검색 모델·Deep Agent 도구 선택은 변경하지 않았다. `/collect`는 모델 객체도 생성하지 않는다.
- 실제 tool activity와 ToolMessage artifact를 유지한다. completed 결과의 도구명·인자, nonnegative integer counters(불리언 제외), companiesProcessed1/failed0/checkedAt을 검사한다. 다운로드0건은 실패로 취급하지 않는다.
- 불완전 SSE·부분 실패·잘못된 결과·HTTP 오류·취소는 오류/취소로 종료한다. 쓰기를 자동 재시도하지 않는다. JSON/SSE에서 안전한 수집 오류 내용을 전달하고 예외 클래스·run ID 진단 로그를 추가했다. 기존 실패 상황 LLM 설명은 유지한다.
- 기존 모델-only/잘못된 모델 인자/반복 모델 호출 테스트는 이제 해당 모델을 전혀 호출하지 않고 정확한 단일 POST를 수행하는 계약으로 수정했다. 완료 검증·실패 검사를 약화하지 않았다.

## 검증: SEC-COLLECT-002

VAL-API-001·VAL-BROWSER-001 적용. Host UI/카탈로그/BFF 구현·DB schema 변경이 없어 순수 View Storybook은 적용 대상이 아니다. 실제 수집으로 저장 메타데이터가 갱신된 것은 사용자가 요청한 서비스 동작이며 취소·롤백하지 않는다.

### Python·정적 검사

- `uv run pytest tests/test_sec_collection.py tests/test_sec_tools.py tests/test_sec_intelligent_ui.py tests/test_sec_prepare.py tests/test_sec_failure_reply.py tests/test_openui_output_repair.py -q`: **134 PASS**, 기존 LangGraph deprecation warning13개.
- 신규29개 수집 회귀: 모델 호출0/정확한 확인 인자/단일 실제 POST/activity, raw artifact 범위, SSE 완료 전 종료·error·부분 실패, 잘못된 counters/checkedAt, 입력 범위, HTTP503/취소, 로그 payload 비노출. 다운로드0/failed0도 성공한다.
- 변경 Python6파일 scoped Ruff PASS. collection/router/new collection test/HTTP fixture scoped Pyright **0 errors / 0 warnings**. `git diff --check` PASS.
- 초기 테스트에서 activity는 기본 since=null을 포함하고 HTTP는 exclude_none으로 생략하는 차이를 확인해 assertion을 실제 계약에 맞췄다. 기존 테스트 파일 import 정렬과 agent EOF 공백도 검사 후 정리했다. 전체 Python workspace 검사가 통과했다고 주장하지 않는다.

### Bruno HTTP E2E: 실제 router·tool, 통제된 BFF

전용 `tests/fixtures/sec_collection_deterministic_http_app.py`,3995/PID1643. 모델 초기화 함수는 호출 시 실패하도록 두어 수집이 모델 객체 없이 실행됨을 확인했다. BFF MockTransport 외의 route/tool/결과 검사는 production 구현이다.

실행: 패키지에서 `PYTHONPATH=src:tests:. uv run python -m uvicorn tests.fixtures.sec_collection_deterministic_http_app:app --host 127.0.0.1 --port 3995`, 컬렉션에서 `../node_modules/.bin/bru run 34-sec-collection --env-var baseUrl=http://127.0.0.1:3995 --reporter-json /tmp/sec-collection-bruno-20261117.json`.

**11 requests / 11 tests / 11 assertions PASS**: JSON/SSE 수집, 정확한 since, 완료 전 종료, 부분 실패, companiesProcessed0, HTTP503, bool counter, upstream error, invalid date/range422, 전체 요청 trace. 유효8개 요청마다 정확한 단일 selected-company POST만 있고 세션 생성0개다. 실패에는 RUN_FINISHED/sec.resolution이 없으며 raw upstream 오류는 노출되지 않는다.

### 실제 사이트: 실제 NVIDIA 수집 완료

Playwright MCP isolatedContext `sec-collect-fix-20261117`에서 `https://reason-web.flin-ai.com/sec-chat`를 열어 **“엔비디아의 최근 2년 공시를 수집해줘.”**를 입력했다. resolve/collect·모델·BFF를 mock하지 않았다.

- 실제 `/resolve` 약6.18초, `/collect` **약0.334초**, 양쪽 HTTP200. collect의 단일 `sync_sec_company_filings` 실제 activity running→completed, `sec.resolution.collection`의 companiesProcessed1/filingsSynced31/downloaded0/failed0/checkedAt, RUN_FINISHED를 확인했다.
- 화면에 `NVIDIA CORP · 공시 수집 / 완료`, 도구 완료1개, 전체 **5개 작업 완료**, 실패0/alert0이 표시됐다. assistant는 메타데이터31건과 원문0건을 구분해 완료를 안내했다. prepare/chat/failure-reply 호출은 없었다.
- 실제 수집 endpoint를 실행한 것이며 새로운 원문을 다운로드했다는 의미는 아니다. 이 실행의 새 다운로드 수는0이다. BFF 데이터/SEC 설정·환경 파일·자격증명은 변경하지 않았다. 기존 SEC_USER_AGENT example 경고는 관찰했으나 이 실행은 완료됐으며 임의의 연락처를 입력하지 않았다.
- 완료 뒤 테스트 파일 편집으로 dev auto reload가 발생했다. 로그상 collect 응답 뒤의 reload이고 최종 수집은 정상 완료한 상태다. 검증 중 쓰기 요청을 추가 재시도하지 않았다.

증거: [완료 화면](evidence/sec-collection-2026-11-17/completed.png), [타임라인](evidence/sec-collection-2026-11-17/timeline.yml), [실제 수집 SSE](evidence/sec-collection-2026-11-17/collection.sse). 기존 favicon404 외의 브라우저 오류는 없었다.

## stock 동기화

- [SEC 기능 설계](../stock/us-corporate-filings/intelligent-ui.md#sec-collect-chat-001-선택-기업-공시-수집): 확정 수집 실행·0건/실패 구분.
- [Python 계약](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-collect-002-확정-수집-요청의-단일-도구-실행): 단일 도구·인자·완료·오류·모델 호출 범위.
- [문서 지도](../INDEX.md)에 실행 기록 추가. 기존 flow는 보존한다.

## VAL-CLEANUP-001

- fixture PID1643을 Ctrl+C로 정상 종료하고 PID 부재·3995 listener 없음 확인. fixture/실제 collect는 분석 세션을 생성하지 않았다.
- MCP 작업 탭을 닫고 browser_close로 No open tabs 확인. 작업 Chrome PID1654 부재 확인. 기존 사용자 서비스·탭·브라우저·공유 MCP는 종료하지 않았다.
- 사용자 데이터 변경은 요청한 실제 수집의 메타데이터 갱신만 유지했다. DB schema·임시 DB·환경·human-docs 변경은 없다. 로컬 Bruno report와 Git에 포함한 공개 공시 검증 증거는 보존한다.
