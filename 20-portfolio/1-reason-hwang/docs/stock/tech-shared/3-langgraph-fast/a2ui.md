# Generative UI LangGraph

과거 A2UI 문서 경로를 보존한다. 공통 계약은 [OpenUI 통합 설계](../openui-migration.md), SEC 업무는 [도메인 설계](../../us-corporate-filings/a2ui-system.md)를 따른다.

- `domains/generative_ui/contracts.py`: strict 요청과 action revision 검증. `actions.py`: 허용 action과 매출·항공편·기내 선택의 서버 계산. `sec.py`: BFF 읽기와 기존 보고서 계획·인용 검증.
- `graph/primary_graphs/generative_ui/workflow.py`: business → openui_output → commit. 모델은 Fixed 의도를 해석하되 실제 항공편 데이터와 선택 확정은 서버가 소유한다.
- `graph/subgraphs/openui_output/workflow.py`: 공통 최종 출력 서브그래프. `controls.py`: 고정 업무 선택 영역. 생성 프로그램과 controls를 같은 프런트 validator로 검사하며 실패하면 상태를 commit하지 않는다.
- `server/generative_ui/router.py`: 세션·SSE·오류 정리. `gate.py`: 중복 실행과 동시성·대기 한도. 브라우저가 보내는 state는 수용하지 않는다.
- `graph/provider/ui_model.py`: 공통 모델 설정과 OAuth Responses 호환. OPENUI_* 우선, 기존 A2UI_* fallback 유지. 기존 push-ui-message 예제도 이 factory를 사용한다.
- SEC Intelligent UI는 공통 compose 진입점을 통해 최종 출력 그래프를 사용한다. 추천 질문은 present 전에 생성한다. 관리자 채팅은 `sec_deep_agent/presentation.py`의 research → openui_output 그래프를 사용한다. 원시 `/research` API는 Markdown 계약을 유지한다.

`pnpm -C 3-langgraph-fast test`와 `test:generative-ui:api`를 사용한다. 후자는 전용 Bruno 환경의 FastAPI 8010·Host 2810에 연결한다. 기본 개발 환경에서는 환경 파일 또는 Bruno `--env-var baseUrl=...`로 대상 주소를 명시한다. UI validator와 SEC BFF는 서버 환경변수에 맞는 주소로 실행되어 있어야 한다.
