# 기내식·좌석 단일 도구 데모

- 날짜: 2026-09-21
- 요청: 기존 항공편 선택을 유지하고 기내식과 좌석을 한 도구로 선택하는 새 데모 추가.
- CABIN-01: display_cabin_options 하나가 두 RadioGroup과 확정 버튼을 포함한 한 surface를 생성한다.
- CABIN-02: confirm_cabin은 모델 호출 없이 checkpoint와 허용 목록을 검증하고 같은 카드를 갱신한다. 다른 항공편 ID, 없는 좌석/기내식, 다른 thread, 확정 후 값 변경을 거절한다.
- 현재 결정: 기존 Fixed 페이지와 endpoint 재사용, 입력 초기값 명시, 가상 선택임을 표시, 확정 후 잠금.
- stock: [LangGraph](../stock/tech-shared/a2ui-system/langgraph.md), [카탈로그](../stock/tech-shared/a2ui-system/registry-and-catalog.md).
- 검증 계획: 단위/계약 → Storybook → 실제 OAuth Bruno → MCP 브라우저를 순차 실행. 기존 항공편 선택 회귀 포함. 결과는 별도 flow에 기록한다.
- 다른 진행 중 작업의 Dynamic progressive 파일과 사용자 문서는 수정·커밋하지 않는다.
