# SEC 저장된 10-K 준비의 모델 의존 제거

- 날짜: 2026-11-17
- 결정 ID: SEC-PREPARE-001
- 범위: `3-langgraph-fast` SEC Research Chat의 `/prepare`, 공통 SEC 도구 실행과 오류 전달.
- 상태: 구현·API·브라우저·scoped 정적 검사·자원 정리 완료.

## 맥락과 확인한 결함

사용자가 이전 UI 응답 보완 이후에도 `NVIDIA CORP · 저장된 10-K 준비` 단계가 실패한다고 보고했다. 이전 [UI 구조화 응답 보완](2026-11-17-sec-ui-structured-repair.md)은 최종 UI 단계에 대한 변경이며 이번 준비 단계를 수정하지 않았다.

기존 prepare는 이미 확정된 CIK에도 모델의 `bind_tools`/ToolNode 루프를 사용했다. 모델이 도구 없이 응답하면 `tools_condition`이 종료하고 실제 목록/content artifact가 없어 준비가 실패했다. 또한 모델이 목록 옵션을 선택하므로 includeAmendments 기본true, since/parserStatus 등의 부적절한 필터가 섞일 여지도 있었다. 준비처럼 정해진 읽기 순서에 불필요한 모델 판단을 요구하는 구현 결함이다.

최근 사용자 요청의 `/prepare`는 SSE HTTP200/약2.2초였으나 예외 내용이 기록되지 않아 그 단일 실패의 직접 원인은 소급 확정하지 않는다. 수정 전 직접 JSON 호출과 조사 중 반복3회, 브라우저 준비는 성공해 간헐성을 확인했다. 브라우저의 수정 전 후속 분석은 준비 확인 뒤 중단하고 새 대화로 정리했다. 이번 변경은 확정 CIK 준비에서 모델의 도구 생략/잘못된 선택 경로 자체를 제거한다. BFF 장애·미다운로드 원문을 성공으로 바꾸는 변경은 아니다.

## 변경과 이유

- `domains/sec_tools/preparation.py`: 실제 기존 StructuredTool을 ToolCall로 순차 호출한다. 모델을 호출하지 않으면서 실제 activity와 전체 원문 artifact를 유지한다. `agent.prepare_filing` 공개 import 경로와 model 위치 인자는 호환용으로 유지한다.
- `refresh=false`: 정확한 CIK의10-K 목록(page1/pageSize10/includeContent=false/includeAmendments=false)을 조회하고 날짜·접수번호로 최신을 선택한다. status/since/parserStatus/ticker 필터를 사용하지 않는다.
- 최신 공시가 pending/failed이면 과거 다운로드 공시로 넘어가지 않고 원문 호출 전에 실패한다. 목록 shape·기업/양식 범위·공시 식별자를 검사하며 본문은 발췌가 아닌 전체 artifact로 파싱한다.
- `refresh=true`일 때만 대상 기업 years2/downloadDocuments=true 동기화를 먼저 실행하고 완료 counter/checkedAt을 확인한다. 요청 기업의 목록이 비어 있을 때만 명시적 predecessor로 이동하며 같은 순서·검사를 반복한다.
- HTTP prepare는 모델 객체도 생성하지 않는다. 원문 파싱이 끝나야 세션을 생성한다. SSE에서도 안전한 SecReadError 내용을 반환해 최신 미다운로드·공시 없음·BFF 오류를 구분할 수 있다. 기타 예외는 기존 공통 메시지를 유지한다.
- 단계 로그는 도구명·예외 클래스, SSE transport 로그는 run ID·예외 클래스만 남긴다. 모델/공시 원문·프롬프트·비밀값을 로그에 넣지 않는다. 취소는 전파한다.

## 검증

요구사항 SEC-PREPARE-001에 VAL-API-001·VAL-BROWSER-001을 적용했다. 순수 View 변경이 없어 Storybook은 적용 대상이 아니다. 실제 수집/DB 변경을 테스트하지 않았으며, 명시적 refresh 경로는 격리 BFF fixture로 검증했다.

### Python·정적 검사

- `uv run pytest tests/test_sec_prepare.py tests/test_sec_tools.py tests/test_sec_intelligent_ui.py tests/test_sec_research_modeling.py tests/test_openui_output_repair.py -q`: **87 PASS**, 기존 LangGraph deprecation warning13개.
- 준비 테스트는 모델 호출0, 정확한 옵션·activity, 최신 pending/failed 보호, predecessor 순서·자체공시 우선, 잘못된 목록·타 기업·타 양식·빈 목록, 불완전 sync, HTTP/취소,20K 초과 전체 artifact 파싱, 로그 payload 비노출을 확인한다.
- 변경 Python5파일 scoped Ruff PASS. preparation/router/fixture/new tests scoped Pyright **0 errors / 0 warnings**. `git diff --check` PASS.
- 전체 package lint/typecheck가 통과했다고 주장하지 않는다. 변경 범위의 정적 검사를 실행했다.

### HTTP API: 통제된 BFF, 실제 router·도구·원문 파서

전용 `tests/fixtures/sec_prepare_http_app.py`는 production prepare router/도구/파서를 사용하고 BFF transport만 고정한다. fixture의 chat_model은 호출 즉시 실패하게 하므로 JSON/SSE 정상 준비가 모델 초기화 없이 실행됨을 검증한다.

실행: 패키지에서 `PYTHONPATH=src:tests:. uv run python -m uvicorn tests.fixtures.sec_prepare_http_app:app --host 127.0.0.1 --port 3993`, 컬렉션에서 `../node_modules/.bin/bru run 32-sec-prepare --env-var baseUrl=http://127.0.0.1:3993 --reporter-json /tmp/sec-prepare-bruno-20261117.json`.

**12 requests / 12 tests / 12 assertions PASS**: JSON/SSE 준비, 명시적 refresh, 최신pending JSON/SSE 실패, 저장공시 없음, BFF503, 잘못된 목록, 실제 요청 trace·세션 수, 세션3개 DELETE. 실패 응답에는 `RUN_FINISHED`/`sec.prepared`가 없고 성공에는 실제 도구 running/completed가 있다. pending 최신에서는 이전 원문을 읽지 않으며 refresh=false에 sync가 없다.

첫 실행의 trace 검사는 fixture trace append 중복으로 POST가 두 번 기록돼 실패했다. fixture 기록을 한 번으로 수정하고 새 fixture 프로세스에서 전부 재실행한 위 결과가 최종 PASS다. production의 중복 HTTP 호출 문제로 숨기지 않았다.

### 실제 사이트 준비 API 10회 반복

`https://reason-web.flin-ai.com/api/sec-chat/prepare`에 `{cik:"0001045810",refresh:false}`와 Accept SSE로10회 순차 요청했다. 실제 저장 BFF·도구·원문 파서를 사용하고 외부 모델 호출은0이다.

**10/10 PASS**, 각0.351~0.418초. 매번 정확한 NVIDIA CIK·checkedAt=null·list/content toolCalls·도구 running/completed×2·RUN_FINISHED 및 RUN_ERROR 부재를 확인했다. 생성한 thread는 매회 finally에서 DELETE했다. 직접 JSON1회도 HTTP200/2.52초였으며 별도로 삭제했다.

증거: [10회 결과](evidence/sec-prepare-2026-11-17/repeated-prepare.json). 이는 순차 smoke 반복이며 부하/동시성 보증은 아니다.

### Playwright MCP: 실제 질문·실제 모델·최종 화면

작업 전용 isolatedContext `sec-prepare-fix-20261117`, 대상 `https://reason-web.flin-ai.com/sec-chat`에서 새 대화의 입력창에 **`Nvida 보고서 뭐있어`**를 입력했다.

NVIDIA CORP의 저장10-K `0001045810-26-000021`(2026-02-25)를 준비하고 최종 답변·검증된 원문 근거·추천 질문까지 정상 표시했다. 펼친 타임라인에서 `NVIDIA CORP · 저장된 10-K 준비`, `list_sec_filings`, `get_sec_filing_content`, 최종 Intelligent UI를 포함해 **12개 모두 완료**, 화면 alert0개를 확인했다. 최종 분석 `/chat`은 약79초이며 이는 준비 API0.35초와 다른 후속 모델 작업이다. 콘솔 오류는 기존 favicon.ico404만 있었다.

증거: [준비 완료 화면](evidence/sec-prepare-2026-11-17/completed.png), [12개 단계 snapshot](evidence/sec-prepare-2026-11-17/timeline.yml). screenshot용 exact text selector는 자식 서비스 라벨이 포함된 요소와 일치하지 않아 timeout이 났고, 관찰된 listitem으로 다시 선택해 완료 행을 확인했다. 제품 실패로 집계하지 않는다.

## stock 동기화

- [Python SEC Intelligent UI](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-prepare-001-확정-기업의-결정적-10-k-준비): 준비 소유권·도구 순서·실패 정책, 기존 model-loop 설명 정정.
- [SEC 기능 설계](../stock/us-corporate-filings/intelligent-ui.md): 기업검색 모델 호출과 확정기업 준비 도구 실행의 구분.
- [문서 지도](../INDEX.md): 이번 기록 진입점 추가. 기존 flow는 수정하지 않는다.

## VAL-CLEANUP-001

- 소유 fixture PID39296을 종료한 뒤 최종 PID39570으로 재실행했고 최종 실행도 Ctrl+C로 정상 종료했다. `ps`에서 두 PID 부재,3993 listener 없음 확인.
- HTTP fixture 세션3개, 실제 반복10개, 직접 JSON 세션, 브라우저 세션을 DELETE/새 대화로 닫았다.
- 작업 탭을 닫은 뒤 browser_close로 No open tabs를 확인했다. 작업 Chrome PID38371 부재를 확인했다. 기존 사용자 서비스·브라우저·공유 MCP는 종료하지 않았다.
- 소스 편집에 따른 기존 dev server auto reload는 발생했다. 별도 강제 재시작·환경파일·자격증명·DB·human-docs 변경은 없다. 브라우저 검증을 끝낸 뒤 agent.py EOF 공백만 정리했으며 업무 코드 변경은 없다.
