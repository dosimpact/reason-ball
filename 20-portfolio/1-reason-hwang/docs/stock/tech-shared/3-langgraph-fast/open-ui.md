# Generative UI LangGraph

OpenUI Lang 출력과 업무 그래프를 관리한다. 공통 계약은 [OpenUI 통합 설계](../openui-migration.md), SEC 기능 경계는 [도메인 설계](../../us-corporate-filings/open-ui-system.md)를 따른다.

- `domains/generative_ui/contracts.py`: strict 요청과 action revision 검증. `actions.py`: 허용 action과 매출·항공편·기내 선택의 서버 계산.
- `graph/primary_graphs/generative_ui/workflow.py`: Dynamic·Fixed의 business → openui_output → commit. 모델은 Fixed 의도를 해석하되 실제 항공편 데이터와 선택 확정은 서버가 소유한다.
- `graph/subgraphs/openui_output/workflow.py`: 공통 최종 출력 서브그래프. `controls.py`: 고정 업무 선택 영역. 생성 프로그램과 controls를 같은 프런트 validator로 검사하며 실패하면 상태를 commit하지 않는다.
- `server/generative_ui/router.py`: 세션·SSE·오류 정리. `gate.py`: 중복 실행과 동시성·대기 한도. 브라우저가 보내는 state는 수용하지 않는다.
- `graph/provider/ui_model.py`: 공통 모델 설정과 OAuth Responses 호환. OPENUI_* 우선, OPEN_UI_* 보조 설정을 지원한다.
- SEC Intelligent UI는 공통 compose 진입점을 통해 최종 출력 그래프를 사용한다. 추천 질문은 present 전에 생성한다. 관리자 채팅은 `sec_deep_agent/presentation.py`의 research → openui_output 그래프를 사용한다. 원시 `/research` API는 Markdown 계약을 유지한다.

`pnpm -C 3-langgraph-fast test`와 `test:generative-ui:api`를 사용한다. 후자는 전용 Bruno 환경의 FastAPI 8010·Host 2810에 연결한다. 기본 개발 환경에서는 환경 파일 또는 Bruno `--env-var baseUrl=...`로 대상 주소를 명시한다. UI validator는 서버 환경변수에 맞는 주소로 실행되어 있어야 한다. Dynamic·Fixed 검증에는 SEC BFF가 필요하지 않다.

## OPENUI-SEC-REMOVE-001: SEC mode 제거

`generative_ui`는 `dynamic`/`fixed`만 허용하며 SEC action·BFF client 연결·전용 controls를 포함하지 않는다.
공유 `SecClient`, `open_ui_report*.py`, 파싱·SEC 도구·`sec_deep_agent` 및 SEC 채팅 출력은 유지한다.

## TA-CANVAS-001: 불변 기술적 분석 동적 캔버스

`technical_analysis_canvas_agent`는 개념 설명과 계산 요청을 구분한다. 설명에는 새 보고서·Yahoo 호출이 없다. `canvas_context.reportId`는 선택 보고서의 가격·조건·지표를 복원하며, `canvas_context.request`는 ticker/interval/count/indicators를 검증한 후 두 기존 업무 도구를 순차 실행하는 명시적 재분석이다. 잘못된 context는 도구 실행 전에 `analysis_error`로 종료한다. 새 분석마다 서버 UUID를 만들고 `canvas_reports` graph state에 보고서를 독립 저장한다. 별도 DB·복원 기능은 추가하지 않는다.

custom stream은 `{channel:"canvas",type,reportId,payload}`이며 open → reset → delta → validating → ready 또는 error 순서다. reset은 서버 소유 prefix를 전달하고 delta는 실제 모델 `astream` 토큰이다. 공급자의 빈 스트림 오류(`No generations found in stream` / `No generation chunks were returned`)에 한해 비스트리밍 생성 한 번으로 fallback하며 전체 결과 한 delta를 보낸다. 인위적 토큰 분할은 없다. 모델은 `taLayout` 하나만 작성하고 `taPanel`·`taSignals`를 각각 한 번 참조한다. 가격/거래량/지표 snapshot과 Query/QueryPanel 및 수치 근거는 서버 prefix가 소유한다. 허용 생성자는 배치와 prose뿐이며 재할당·새 Query·숫자 데이터 재정의를 차단한다. 완성 프로그램은 Host parser 검증 후 한 번 수정하고, 실패하면 계산 결과 텍스트로 fallback한다.

`technical_analysis_canvas_agent`는 values+custom stream을 사용하고 최종 assistant 메시지는 짧은 보고서 안내만 제공한다. 기존 `technical_analysis_agent`는 values 기반 인라인 presentation을 유지한다. Query는 기존 `technical_analysis_chart`를 사용하며 모델 없이 ticker/주기/봉 수/수동 갱신을 처리한다. 기본 polling은 0이다. 실행 검증은 별도 API 검증 기록을 따른다; 브라우저 검증은 사용자 담당이다.


### TA-CANVAS-002: 기존 인라인 TA와 독립 graph 분리

`technical_analysis_agent`는 기존 인라인 동작을 유지한다. 기존 `TechnicalAgentState`로 Yahoo/TA-Lib 업무 도구를 실행하고 `build_output_graph(program_builder=build_program)`의 결정적 프로그램을 `presentation={id,program}`으로 반환한다. canvas context/custom event/report map은 이 graph의 입력·상태 계약에 없다.

`technical_analysis_canvas_agent`는 별도 `primary_graphs/technical_analysis_canvas_agent` workflow와 `TechnicalCanvasAgentState`를 사용한다. Canvas state는 원래 계산 상태를 상속하며 `canvas_context`, `canvas_reports`, `canvas_route`, `canvas_report_id`만 추가한다. 원래 에이전트의 `build_tools`와 같은 도메인 가격·지표 계산/표시 함수를 공유하므로 계산 구현을 복제하지 않는다. 두 graph를 `langgraph.json`에 각각 등록하며 캔버스용 Host custom stream/보고서 UI는 신규 ID에만 적용한다.
