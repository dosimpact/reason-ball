# SEC 작업 실패 후에도 대화형 답변 제공

- 날짜: 2026-11-17
- 결정 ID: SEC-FAILURE-REPLY-001
- 범위: SEC Research Chat Host·Python API. 실패 설명과 정상 분석 결과를 구분한다.
- 상태: 구현·필수 API/MCP 브라우저·회귀·정적 검사·자원 정리 완료.

## 맥락과 결정

사용자가 “실패하더라도 llm 그에 맞는 답변”을 요청했다. 기존 SecChat catch는 오류 안내와 활동만 표시하고 빈 assistant 메시지를 저장했다. 준비/UI 실패 자체를 수정하는 앞선 변경과 별도로, 모든 SEC 대화 실패에서 사용자가 읽을 수 있는 설명이 필요하다.

작업 실패를 성공으로 바꾸지 않고 별도 plain LLM 응답으로 완료하지 못한 범위와 다음 행동을 설명한다. 실패한 OpenUI 생성·validator 경로에 다시 의존하지 않는다. 이 설명에 연구 결과·수치·근거·추천 질문을 새로 만들지 않으며 알려지지 않은 장애 원인을 추정하지 않는다. 설명 모델까지 실패하면 제한된 기본 안내문으로 빈 턴을 방지한다.

## 구현

- Python `domains/sec_chat/failure_reply.py`와 `POST /api/sec-chat/failure-reply`: `{message,stage,reason?,company?}` → `{reply,source:"model"|"fallback"}`. 단계는 resolve/prepare/chat/collect, reason은 원문 미준비/저장 공시 없음/세션 만료/연결 실패/형식 오류/미상 중 하나다. 추가 필드·원시 오류·history를 받지 않는다.
- 기존 chat_model을 지연 생성하고 도구·graph·OpenUI·validator 없이 plain ainvoke 한 번을 수행한다.15초 제한, 빈 응답·2500자 초과·provider/초기화 오류에는 단계/reason 기본 문장을 반환한다. 취소 예외는 전파하며 로그는 예외 클래스만 남긴다. 세션/업무 이력/수집 상태를 만들거나 변경하지 않는다.
- Host `api/failure-reply.ts`:20초 client 상한·원래 AbortSignal·응답 shape/길이 검사·기본 안내. 알려진 오류 문구를 enum으로 변환하며 원시 오류를 새 모델에 보내지 않는다. Next 프록시 allowlist에 endpoint를 추가한다.
- SecChat은 실제 실패 단계와 선택 기업을 추적한다. 기존 failed activity·오류 안내·세션 만료·후보 선택을 유지하고 별도 `실패 상황 답변 생성` activity를 추가한다. source=model은 completed, 기본 안내는 unavailable이다. 일반 assistant text를 저장해 기존 ConversationText로 표시한다. 실패를 성공 분석으로 바꾸지 않는다.
- 원래 작업 중단 시 설명을 요청하지 않는다. 설명 중 중단은 늦은 결과를 버리고 중단 문장을 저장한다. 설명 자체의 실패에 재귀 호출하지 않는다.
- SDK가 native 실행 중 plain assistant를 custom renderer에 넘기지 않는 문제도 확인했다. SEC의 임시 busy 메시지만 실제 상태 문장을 JSON 이스케이프한 OpenUI Markdown으로 전달해 기존 live ActivityTimeline/ChatNotice를 표시한다. 사용자·저장 메시지 계약과 공유 adapter는 바꾸지 않았다.

## 검증: SEC-FAILURE-REPLY-001

VAL-API-001·VAL-BROWSER-001을 적용했다. View 전용 컴포넌트 변경은 없어 별도 Storybook은 적용 대상이 아니다. 카탈로그/컴포넌트 등록 변경은 없다.

### Python·Host 정적/단위 검사

- `uv run pytest tests/test_sec_failure_reply.py tests/test_sec_intelligent_ui.py tests/test_sec_prepare.py tests/test_sec_tools.py tests/test_openui_output_repair.py -q`: **105 PASS**, 기존 LangGraph deprecation warning13개.
- 신규 Python25개: 모델 응답·text block, 빈/초과 출력, provider/초기화/timeout 기본 안내, 취소, prompt injection 데이터 경계, reason별 처리, strict HTTP422, 세션 불변, 로그 payload 비노출.
- `pnpm -C 1-fe-host exec tsx --test tests/sec-chat/failure-reply.test.ts`: **3 PASS**. enum 분류, 제한된 요청·응답 검사, 오류 기본 안내, 취소 전파.
- `pnpm -C 1-fe-host typecheck`: PASS. 변경 Host TS/TSX/test scoped ESLint PASS.
- Python helper/router/new test/HTTP fixture scoped Ruff PASS·Pyright **0 errors / 0 warnings**.
- `git diff --check`: PASS. 전체 Python workspace lint/typecheck 통과로 보고하지 않는다.

### Bruno HTTP E2E

전용 fixture `tests/fixtures/sec_failure_reply_http_app.py`는 실제 router·request schema·failure helper를 사용하고 모델 경계만 고정한다. 포트3994/PID41791. 실행은 패키지의 `PYTHONPATH=src:tests:. uv run python -m uvicorn tests.fixtures.sec_failure_reply_http_app:app --host 127.0.0.1 --port 3994`, 컬렉션에서 `../node_modules/.bin/bru run 33-sec-failure-reply --env-var baseUrl=http://127.0.0.1:3994 --reporter-json /tmp/sec-failure-reply-bruno-20261117.json`.

**10 requests / 10 tests / 10 assertions PASS**: prepare/chat 모델 응답, provider/빈 응답 기본 안내, 잘못된 stage/reason·추가 raw 오류·공백 질문·잘못된 기업422, 유효4개만 모델 호출·세션0개 확인. 실제 공급자 품질 검증은 아래 MCP 실행과 구분한다.

### Playwright 회귀

`SEC_LIVE_BASE_URL=https://reason-web.flin-ai.com pnpm -C 1-fe-host test:sec-chat:live tests/e2e/sec-conversation.spec.ts --workers 1`: 최종 **16 PASS**,57.1초. 이 CLI suite의 SEC 응답과 failure model은 route fixture이며 실제 모델 성공으로 해석하지 않는다.

신규6개는 네 단계 실패 후 assistant 설명·정확한 단계/기업/reason·원래 실패 activity·설명 완료·근거/추천 부재·기록 저장, 설명 API 장애 기본 안내, 설명 중 취소·늦은 결과 미표시를 검사한다. 기존 정상·재시도·중단·후보·refresh·수집·기록 복원도 통과했다.

초기 실행은14/16으로 두 기존 검사가 실패했다. 진행 중 custom timeline이 SDK의 plain content gate로 가려져 SEC 임시 메시지에 실제 OpenUI 상태 프로그램을 적용했다. 기록 복원 검사는 숨겨진 중복 헤더 summary를 `.first()`로 선택해 timeout이 났으므로 실제 표시 중인 summary locator로 수정했다. 실패했던2개와 신규6개를 재검사해8/8, 이어 전체16/16을 확인했다. 테스트를 약화하거나 실패를 생략하지 않았다.

### MCP: 실제 사이트·실제 실패 설명 모델

Playwright MCP isolatedContext `sec-failure-reply-20261117`의 입력창에서 `Nvida 보고서 뭐있어`를 보냈다. 테스트 탭의 `/prepare`에만 최신10-K 원문 미다운로드 RUN_ERROR를 주입했다. 실제 데이터/수집 상태를 변경하지 않았으며 `/resolve`와 `/failure-reply`는 실제 서비스·모델이다.

- `/failure-reply` HTTP200, response `source:"model"`. NVIDIA의 SEC10-K를 분석용으로 준비하지 못해 내용을 확인할 수 없다는 설명과 다시 준비할 다음 단계를 실제 화면에서 확인했다. 원래 prepare는 실패, 설명 생성은 완료, 타임라인은 `일부 작업 실패`를 유지했다. [모델 답변 화면](evidence/sec-failure-reply-2026-11-17/model-reply.png), [snapshot](evidence/sec-failure-reply-2026-11-17/model-reply.yml).
- 첫 실제 모델 응답이 prepare를 “제출 준비”로 표현해 프롬프트에 분석용 저장원문 준비와 SEC 제출의 차이를 명시했다. 같은 질문으로 새 대화를 실행해 “NVIDIA(NVDA)의 최신 SEC 10-K 원문을 분석용으로 준비하지 못했습니다”라는 수정 후 실제 모델 응답을 확인했다. 최종 증거는 이 응답이다.
- 다음 새 대화에서는 같은 prepare 실패에 failure-reply HTTP502도 주입했다. 단계별 기본 안내가 assistant에 표시되고 설명 activity는 unavailable, 원래 실패1개와 근거0개를 확인했다. [기본 안내 화면](evidence/sec-failure-reply-2026-11-17/fallback-reply.png), [snapshot](evidence/sec-failure-reply-2026-11-17/fallback-reply.yml).
- 기록 새로고침 확인 중 숨겨진 header summary selector timeout을 관찰하고 실제 visible summary로 기록 보존을 확인했다. 콘솔의 주입된502와 기존 favicon404는 시나리오/기존 자원 오류이며 새로운 JS 예외는 관찰하지 않았다.

## stock 동기화

- [SEC 기능](../stock/us-corporate-filings/intelligent-ui.md#sec-failure-reply-001-실패-상황의-대화형-응답): 실패 설명과 정상 연구 결과 구분.
- [Python 계약](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md#sec-failure-reply-001-별도-실패-설명-api): 입력·모델 경계·timeout·fallback·세션 불변.
- [Host 동작](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md#sec-failure-reply-001-실패-후에도-assistant-답변-표시): 단계 문맥·활동·취소·진행 상태 표시.
- [문서 지도](../INDEX.md)에 진입점 추가. 기존 flow는 보존한다.

## VAL-CLEANUP-001

- fixture PID41791을 Ctrl+C로 정상 종료하고 PID 부재·3994 listener 없음을 확인했다. API는 세션을 생성하지 않았고 trace에서도0개였다.
- MCP의 테스트 route와 localStorage는 전용 isolated context에 한정했다. 작업 탭을 닫은 뒤 browser_close로 No open tabs를 확인했으며 Chrome PID41877 부재를 확인했다. 사용자 탭·브라우저·공유 MCP·기존 서비스는 종료하지 않았다.
- CLI Playwright는 완료 후 소유 browser/worker를 종료했다. 테스트는 외부 서버를 시작하거나 종료하지 않고 지정한 관련 Host를 사용했다. 보고서는 로컬 `1-fe-host/playwright-report/`, `1-fe-host/test-results/sec-chat-report.json`, Bruno report는 위 `/tmp` 경로에 남는다.
- 소스 수정에 따른 기존 dev server auto reload는 발생했다. 환경·자격증명·DB·human-docs·카탈로그 생성물은 변경하지 않았다.
