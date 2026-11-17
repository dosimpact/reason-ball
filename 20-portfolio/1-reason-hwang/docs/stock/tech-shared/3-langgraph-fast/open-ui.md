# Generative UI LangGraph

OpenUI Lang 출력과 업무 그래프를 관리한다. 공통 계약은 [OpenUI 통합 설계](../openui-migration.md), SEC 기능 경계는 [도메인 설계](../../us-corporate-filings/open-ui-system.md)를 따른다.

- `domains/generative_ui/contracts.py`: strict 요청과 action revision 검증. `actions.py`: 허용 action과 매출·항공편·기내 선택의 서버 계산.
- `graph/primary_graphs/generative_ui/workflow.py`: Dynamic·Fixed의 business → openui_output → commit. 모델은 Fixed 의도를 해석하되 실제 항공편 데이터와 선택 확정은 서버가 소유한다.
- `graph/subgraphs/openui_output/workflow.py`: 공통 최종 출력 서브그래프. `controls.py`: 고정 업무 선택 영역. 생성 프로그램과 controls를 같은 프런트 validator로 검사하며 실패하면 상태를 commit하지 않는다.
- `server/generative_ui/router.py`: 세션·SSE·오류 정리. `gate.py`: 중복 실행과 동시성·대기 한도. 브라우저가 보내는 state는 수용하지 않는다.
- `graph/provider/ui_model.py`: 공통 모델 설정과 OAuth Responses 호환. OPENUI_* 우선, OPEN_UI_* 보조 설정을 지원한다.
- SEC Intelligent UI는 공통 compose 진입점을 통해 최종 출력 그래프를 사용한다. 추천 질문은 present 전에 생성한다. 관리자 채팅은 `sec_deep_agent/presentation.py`의 research → openui_output 그래프를 사용한다. 원시 `/research` API는 Markdown 계약을 유지한다.

## SEC-UI-REPAIR-001: 구조화 응답과 프로그램 검증

공통 composer의 모델 응답은 `GeneratedUI` JSON 객체이며 `program` 문자열 안에 완전한 OpenUI 프로그램을 담는다. 프롬프트도 같은 envelope를 명시한다. 구조화 응답 파싱·Pydantic 스키마 오류(빈 응답·잘못된 형태 포함)와 Host DSL parser 오류는 전체 두 번의 모델 호출 안에서 한 번 수정할 수 있다. 형식이 올바른 프로그램만 실제 Host validator로 보내며 두 번째 실패는 오류로 종료한다. 고정 UI로 대체하거나 실패한 결과를 성공으로 표시하지 않는다.

공급자·네트워크 오류와 validator 연결 오류는 형식 수정으로 재시도하지 않는다. 취소는 그대로 전파한다. 서버 진단 로그는 compose/schema/DSL/validator 단계, 시도 횟수, 예외 클래스 또는 오류 개수만 남긴다. 프롬프트·모델 원문·프로그램·parser 오류 본문은 기록하지 않는다. 이 단계 로그로 과거 실패 원인까지 소급 확정할 수는 없다.

회귀 테스트는 `tests/test_openui_output_repair.py`, HTTP 검증은 `bruno-api-tests/31-sec-ui-repair/`와 전용 fixture를 사용한다. [변경·검증 기록](../../../flow/2026-11-17-sec-ui-structured-repair.md).

`pnpm -C 3-langgraph-fast test`와 `test:generative-ui:api`를 사용한다. 후자는 전용 Bruno 환경의 FastAPI 8010·Host 2810에 연결한다. 기본 개발 환경에서는 환경 파일 또는 Bruno `--env-var baseUrl=...`로 대상 주소를 명시한다. UI validator는 서버 환경변수에 맞는 주소로 실행되어 있어야 한다. Dynamic·Fixed 검증에는 SEC BFF가 필요하지 않다.

## OPENUI-SEC-REMOVE-001: SEC mode 제거

`generative_ui`는 `dynamic`/`fixed`만 허용하며 SEC action·BFF client 연결·전용 controls를 포함하지 않는다.
공유 `SecClient`, `open_ui_report*.py`, 파싱·SEC 도구·`sec_deep_agent` 및 SEC 채팅 출력은 유지한다.

## TA-CANVAS-001: 불변 기술적 분석 동적 캔버스

`technical_analysis_canvas_agent`는 개념 설명과 계산 요청을 구분한다. 설명에는 새 보고서·Yahoo 호출이 없다. `canvas_context.reportId`는 선택 보고서의 가격·조건·지표를 복원하며, `canvas_context.request`는 ticker/interval/count/indicators를 검증한 후 두 기존 업무 도구를 순차 실행하는 명시적 재분석이다. 잘못된 context는 도구 실행 전에 `analysis_error`로 종료한다. 새 분석마다 서버 UUID를 만들고 `canvas_reports` graph state에 보고서를 독립 저장한다. 별도 DB·복원 기능은 추가하지 않는다.

현재 Canvas는 values의 `presentation={id,program}`과 `canvas_reports`에 검증된 완성 프로그램을 게시한다. 모델의 내부 토큰 스트림을 사용자 Canvas에 게시하지 않는다. 공통 composer가 전체 프로그램을 생성하며 서버 UUID를 포함한 요소 ID 집합을 추가 검증한다. 실패 시 계산 결과 텍스트와 저장 근거를 보존한다.

가격·지표 차트는 기존 `technical_analysis_chart` Query로 조회하며 ticker/주기/봉 수/수동 갱신은 모델 없이 처리한다. 기본 polling은 0이다. 분석 설명은 채팅에, 선택 가능한 CanvasItem은 같은 답변에 표시하고 사용자가 추가한다.


### TA-CANVAS-002: 기존 인라인 TA와 독립 graph 분리

`technical_analysis_agent`는 기존 인라인 동작을 유지한다. 기존 `TechnicalAgentState`로 Yahoo/TA-Lib 업무 도구를 실행하고 `build_output_graph`의 LLM 생성·검증 프로그램을 `presentation={id,program}`으로 반환한다. canvas context/custom event/report map은 이 graph의 입력·상태 계약에 없다.

`technical_analysis_canvas_agent`는 별도 `primary_graphs/technical_analysis_canvas_agent` workflow와 `TechnicalCanvasAgentState`를 사용한다. Canvas state는 원래 계산 상태를 상속하며 `canvas_context`, `canvas_reports`, `canvas_route`, `canvas_report_id`만 추가한다. 원래 에이전트의 `build_tools`와 같은 도메인 가격·지표 계산/표시 함수를 공유하므로 계산 구현을 복제하지 않는다. 두 graph를 `langgraph.json`에 각각 등록하며 캔버스용 선택 요소/보고서 UI는 Canvas graph에만 적용한다.

## OPENUI-CATALOG-001: 실제 생성 프롬프트와 최신 카탈로그

`graph/subgraphs/openui_output/catalog.py::load_openui_catalog`는 frontend generator가 동기화하는 `generated/system-prompt.txt`를 매 생성 호출 시 UTF-8로 읽는다. module import 시 본문을 저장하거나 캐시하지 않는다. 따라서 dev의 이미 로드된 graph나 FastAPI registry가 같은 builder를 재사용하더라도 다음 생성은 갱신된 artifact를 읽는다. Python 코드 변경을 배포하는 것과 카탈로그 artifact 내용 갱신은 별개다. 최신 artifact를 배포하지 않은 상태까지 loader가 자동 생성해 주는 것은 아니다. frontend의 `openui:check`가 library→txt/spec/Python mirror의 일치 여부를 확인한다.

| 등록 graph | 실제 출력/프롬프트 경계 | 카탈로그 적용 |
| --- | --- | --- |
| main_graph | provider의 일반 텍스트 답변 | OpenUI를 직접 생성하지 않으므로 미주입 |
| simple_llm | 일반 대화 메시지 | 미주입 |
| technical_analysis_graph | 주입 OHLCV 계산 도구와 설명 | 미주입 |
| price_agent | 가격 요청·조회·구조화 결과 | 미주입 |
| starter_graph | 도구 기반 일반 대화 | 미주입 |
| tenk_subgraph | RetrievalService의 근거·텍스트 답변 | 미주입 |
| sec_deep_agent | 원시 연구/Markdown | 업무 프롬프트에는 미주입. 별도 research UI 경로는 공유 composer 사용 |
| technical_analysis_agent | compact 결과 → 공통 LLM composer → inline presentation | 최신 카탈로그·예시와 표시 context 제공, parser 검증 |
| technical_analysis_canvas_agent | compact 결과 → 공통 LLM composer → CanvasItem presentation | 최신 카탈로그·예시 제공, parser와 서버 요소 ID 검증 |
| talib_agent | bounded 계산 결과 → 공통 LLM composer | 최신 카탈로그·예시 제공, parser 검증 |
| sec_modeling_agent | 모델링 도구 실행과 상태/메시지 | 미주입 |

등록 목록 밖의 SEC Intelligent UI, SEC research UI, generative_ui dynamic 경로도 `openui_output._compose_ui`를 통해 같은 loader를 사용한다. Fixed controls처럼 서버가 작성하는 DSL에는 모델 프롬프트 주입이 필요하지 않다. 이름에 open_ui가 포함된 과거 구조화 보고서 계획과 실제 openui-lang 생성도 구분한다.

세 분석 그래프의 전체 UI 생성은 `build_output_graph`의 공통 경로를 사용한다. `presentation_context`는 서버가 만든 요청 조건·데이터 범위·Canvas 요소 ID를 전달한다. `program_builder` 우회와 이전 Canvas taLayout 전용 composer는 제거했다. 모델은 공통 카탈로그의 전체 컴포넌트를 조합하되 실행 Query allowlist와 출력 검증은 유지한다. Fixed 업무 controls는 서버 작성 DSL을 유지한다.

카탈로그는 `library.ts`가 내보내는 `promptOptions`의 examples/additionalRules까지 CLI로 생성한다. 카탈로그 교체 시 다음 호출에서 다시 읽으며, FE/Python artifact 일치는 openui:check로 검사한다. 생성 실패 시 TA·Canvas·TA-Lib은 계산 상태와 텍스트를 보존하며 취소는 전파한다. [현재 표시 계약](../../technical-analysis/system-design.md#openui-compose-001-공통-카탈로그-기반-생성), [검증 기록](../../../flow/2026-11-17-openui-llm-composition.md).

## SEC-STARTERS-001: 호스트 원문 인용 보호

호스트 근거 패널이 있고 SEC findings가 있는 경우 composer는 Quote 구성요소와 Markdown 인용을 생성하지 않도록 지시한다. 실제 프로그램에서는 문자열 리터럴을 제외한 Quote 생성자를 추가 검사하며 기존 전체2회 생성 예산 안에서 수정한다. 정확한 원문 인용은 호스트가 표시한다. 일반 개념 답변과 host_evidence=false 경로의 Quote 사용은 유지한다. 이 검사는 요약의 모든 의미나 Markdown 내용의 자동 사실 검증이 아니다. 서버 소유 filingContext의 제출일·접수번호를 정확히 표시하고 내부 필드명은 화면에 노출하지 않도록 지시한다. 표의 총계에는 제품·서비스 등 실제 집계 범위를 보존하며 게시 모델링의 빈 조회를 자료 자체의 절대 부재로 바꾸지 않는다. [검증 기록](../../../flow/2026-11-17-sec-starters-regression.md).

## CHAT-LLM-001: 현재 모델 설정

OpenUI 출력의 provider·모델·주소·키는 [공통 채팅 LLM 설정](chat-llm-provider.md)의 `CHAT_LLM_*`을 따른다. 이전 OPENUI_MODEL/OPEN_UI_MODEL override는 공통 선택을 변경하지 않는다. OAuth 출력의 Responses 호환 방식은 유지한다.
