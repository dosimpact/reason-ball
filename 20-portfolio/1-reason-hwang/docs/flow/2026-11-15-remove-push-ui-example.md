# PUSH-UI-REMOVE-001: Push UI 예제 제거

- 날짜: 2026-11-15
- 요청: `/examples/push-ui-message` 데모와 LangGraph `simple_push_ui_message` 샘플만 제거한다.
- 범위: 전용 Host 페이지·프록시·UI·테스트, LangGraph 라우터·그래프·테스트·Bruno 요청을 삭제했다. 메뉴와 graph discovery의 전용 입력 예시, graph 등록, 패키지 테스트 명령을 제거했다.
- 보존: 공용 AgentConversation/OpenUI UI, `/chat`의 일반 JSON graph discovery, 다른 채팅/그래프, 작업 전 사용자 변경, `human-docs/`, 기존 append-only flow 이력을 보존했다. 작업 코드에서 `push_ui_message`의 다른 사용처는 발견되지 않았다.
- Stock: [문서 지도](../INDEX.md), [tech-shared 지도](../stock/tech-shared/INDEX.md), [Host 아키텍처](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md), [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md), [LangGraph OpenUI](../stock/tech-shared/3-langgraph-fast/open-ui.md)에서 현재 범위를 동기화했다. 예제 전용 stock 문서를 제거했다.
- 검증: 활성 FE/LangGraph 소스와 현재 stock/index에서 예제 문자열 참조가 없는 것을 확인했다. 관련 package JSON과 `langgraph.json` 파싱 및 graph/script 제거 확인 PASS. 테스트와 브라우저 검증은 실행하지 않았다.
- 역사: 기존 `2026-10-02` 및 이전 flow의 당시 기록은 append-only 원칙에 따라 수정하지 않았다. 이 flow가 제거 결정을 기록한다.
