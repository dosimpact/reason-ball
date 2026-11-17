# SEC UI 구조화 응답 복구와 실제 사이트 검증

- 날짜: 2026-11-17
- 결정: SEC-UI-REPAIR-001
- 범위: 공통 OpenUI 출력 composer와 SEC Research Chat 검증. 화면/API 계약 변경 없음.
- 상태: 구현·필수 scoped 검증·소유 자원 정리 완료.

## 맥락과 원인 확정의 한계

사용자가 NVIDIA 요청의 마지막 `Intelligent UI 구성 및 검증` 단계 실패를 보고하고 카탈로그 생성·동기화 누락을 의심했다. 이후 제공한 원문 질문은 `Nvida 보고서 뭐있어`, 검증 대상은 `https://reason-web.flin-ai.com/sec-chat`이다.

`pnpm -C 1-fe-host openui:check`는 현재 원본59개 컴포넌트와 FE prompt/spec·Python mirror의 바이트 일치를 확인했다. `.env`의 validator URL은 실행 중인 Host2983을 가리켰고 짧은 프로그램 검증은 valid=true였다. 카탈로그를 강제 재생성하거나 환경변수·공급자를 변경하지 않았다.

조사 당시 최근 실패 `/chat` 뒤에 validator 요청이 없었지만 정확한 실패 요청과 로그를 식별할 상관관계/예외 로그가 없었다. 따라서 과거 실패를 구조화 파싱 문제로 확정하지 않는다. 수정 전 별도 실제 UI 생성 호출과 실제 사이트의 NVIDIA Item1 핵심3가지 요약도 성공했다.

확인된 구현 누락은 모델의 구조화 응답 파싱·스키마 오류가 기존 DSL 수정 재시도 바깥에 있다는 점이다. 기존 프롬프트의 완전한 프로그램 반환 지시도 GeneratedUI JSON envelope를 명확히 설명하지 않았다.

## 변경과 이유

- `GeneratedUI`의 `program` 문자열 안에 전체 OpenUI 프로그램을 담도록 프롬프트를 명확히 했다.
- OutputParserException·Pydantic ValidationError와 None/잘못된 응답 형태를 같은 전체2회 모델 호출 예산에서 한 번 수정한다. DSL parser 수정도 같은 예산을 공유한다.
- 올바른 형식의 프로그램만 실제 Host validator로 보낸다. 두 번째 형식/DSL 실패는 오류로 종료하며 고정 UI fallback으로 숨기지 않는다.
- 공급자·네트워크·validator 연결 오류를 형식 수정으로 재시도하지 않는다. 취소 전파를 유지한다.
- compose/schema/DSL/validator 실패 로그는 예외 클래스·시도 횟수·오류 개수만 기록한다. 프롬프트·원시 모델 출력·프로그램·parser 메시지 본문은 기록하지 않는다.

## 검증: SEC-UI-REPAIR-001 / VAL-API-001 / VAL-BROWSER-001

### Python·정적 검사

- `uv run pytest tests/test_openui_output_repair.py tests/test_openui_catalog.py tests/test_sec_intelligent_ui.py tests/test_generative_ui_graph.py -q`: **46 PASS**, 기존 LangGraph deprecation warning13개.
- 신규13개 회귀: 파싱/스키마/None/잘못된 형태 복구, 반복 형식 실패, 형식·DSL 공유 재시도 예산, 공급자/취소/validator 연결 오류 전파, 로그 payload 비노출.
- 변경 Python3파일 scoped Ruff PASS, scoped Pyright **0 errors / 0 warnings**.
- 에이전트의 최초 package lint 실행은 기존 전체71개 오류를 보고했다. 이 변경의 scoped Ruff는 통과했으며 전체 lint 통과로 보고하지 않는다.
- `pnpm -C 1-fe-host openui:check`: PASS. `git diff --check`: PASS.
- 순수 View 변경이 없어 Storybook은 적용 대상이 아니다.

### 실제 HTTP와 통제된 모델 실패

전용 `tests/fixtures/sec_ui_repair_http_app.py`는 production SEC router/graph/composer를 사용한다. 모델과 filing/BFF 경계만 fixture이고 OpenUI 검증은 실제 Host2983 parser로 HTTP 호출한다. DB 변경·외부 모델 비용은 없다.

실행: 패키지에서 `PYTHONPATH=src:tests:. SEC_CHAT_UI_VALIDATOR_URL=http://127.0.0.1:2983/api/sec-ui/validate uv run python -m uvicorn tests.fixtures.sec_ui_repair_http_app:app --host 127.0.0.1 --port 3992`, 컬렉션 디렉터리에서 `../node_modules/.bin/bru run 31-sec-ui-repair --env-var baseUrl=http://127.0.0.1:3992 --reporter-json /tmp/sec-ui-repair-bruno-20261117.json`.

**7 requests / 7 tests / 7 assertions PASS**: prepare, malformed→정상, None→정상, DSL 오류→정상, 반복 형식 실패, 공급자 실패, DELETE cleanup. 성공은 RUN_FINISHED·완료 activity·근거·본문을 확인한다. 실패는 RUN_ERROR·실패 activity와 성공/본문 이벤트 부재를 확인한다. 이는 실제 공급자의 재시도 발생을 증명하는 테스트는 아니다.

### 실제 사이트·실제 모델

Playwright MCP의 작업 전용 isolatedContext `sec-ui-fix-20261117`에서 UI 입력·새 대화·타임라인 펼치기로 검증했다.

| Given / When | 실제 결과 |
| --- | --- |
| 수정 전 새 대화에서 저장된 NVIDIA Item1 핵심3가지 요약 요청 | 정상 UI·근거·추천 질문,12개 작업 완료. 기존 실패 미재현 |
| 수정 후 새 대화에서 Item1 핵심3가지와 사업 부문 표 요청 | 정상 표·근거·추천 질문,12개 작업 완료. `/chat` 약70초 |
| 최종 코드로 새 대화에서 원문 `Nvida 보고서 뭐있어` 입력 | NVIDIA CORP로 해석,10-K `0001045810-26-000021`(2026-02-25) 준비,12개 작업 완료. Intelligent UI 단계 완료·표2개·근거 패널1개·원문 링크1개·blockquote6개·추천 질문 표시. 실패 activity/화면 alert0개. `/chat` 약80초 |

처음에는 코드 reload로 만료된 테스트 세션에 입력해 resolve404가 발생했다. 이를 기록하고 새 대화에서 원문을 다시 실행한 최종 결과가 위 PASS다. 별도 favicon.ico404도 관찰됐으며 이 변경 범위에는 포함하지 않았다. 최종 원문 시나리오의 resolve/prepare/chat은 HTTP200이며 실제 화면과 완료 activity를 함께 확인했다. 성공 실행에서 구조화 재시도가 실제 발생했다고 주장하지 않는다.

증거: [원문 질문 완료 화면](evidence/sec-ui-2026-11-17/original-question.png). 세부 snapshot은 로컬 `.playwright-mcp/sec-ui-original-question-20261117.yml`, Bruno report는 위 `/tmp` 경로에 보존한다.

## stock 동기화

- [공통 Python OpenUI](../stock/tech-shared/3-langgraph-fast/open-ui.md#sec-ui-repair-001-구조화-응답과-프로그램-검증): 모델 envelope·수정 예산·로그·실패 전파.
- [SEC Intelligent UI](../stock/us-corporate-filings/intelligent-ui.md#자유로운-intelligent-ui-구성-sec-iui-007): 기능 계약과 공통 구현 연결.
- [문서 지도](../INDEX.md): 기록 진입점 추가.

## VAL-CLEANUP-001

- 작업 소유 fixture PID34102→34270→35191을 매 재실행 전 정상 종료했고 마지막 서버도 Ctrl+C로 종료했다. `ps`에서 모두 부재,3992 listener 없음 확인.
- Bruno 세션은 DELETE로 정리했다. 실제 브라우저 세션은 새 대화로 닫고 작업 탭을 닫은 뒤 MCP browser_close를 실행했다. No open tabs 및 Chrome PID33417과 확인한 자식33433/33437/33441/33442 부재 확인.
- 기존 사용자 서비스와 공유 MCP는 종료하지 않았다. 소스 수정에 따른 기존 개발 서버 자동 reload는 발생했으며 별도 강제 재시작은 하지 않았다. 환경 파일·자격증명·human-docs는 변경하지 않았다.

## 남은 한계

과거 단일 실패의 직접 원인은 확정되지 않았다. 이번 수정은 실제로 확인한 복구 누락과 진단 공백을 보완하며 원문 질문의 현재 정상 동작을 검증한다. 같은 단계가 재발하면 새 단계 로그의 예외 유형과 발생 시각을 함께 확인할 수 있다.
