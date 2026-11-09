# 2026-11-08 OpenUI 업무 action 및 통합 그래프

- OPENUI-MIG-001/002: 서버 소유 action 계약, 매출 집계·항공편·기내식·좌석 전이, SEC 업무 함수, 최종 출력 서브그래프, AG-UI endpoint를 추가했다.
- Fixed 고정 화면과 SEC 탐색을 OpenUI DSL로 생성한다. 모델은 업무 결과의 표현만 담당한다. 화면 연결과 CopilotKit 제거는 아직 진행 중이다.
- 검증: `uv run pytest tests/test_generative_ui_actions.py tests/test_generative_ui_graph.py tests/test_sec_intelligent_ui.py tests/test_sec_admin_chat.py -q` → 34 passed (3.49s). 매출 집계, stale/외부 항공편 거부, 세 cabin 모드, SEC 회사 소유권, 출력 실패 시 상태 보존을 검사했다.
- 실제 생성된 frontend spec 및 createParser로 Dynamic·SEC 초기·Fixed flight/meal/seat/both 6개 프로그램 검사: errors/unresolved 없음, root 존재.
- API·Storybook·MCP·실모델 검증 미실행. 전체 완료 아님.
- 자원: 서버·브라우저 미생성. 임시 parser 입력은 `/tmp/reason-hwang-openui-controls.json`이며 검증 후 삭제했다.
- stock: [통합 설계](../stock/tech-shared/openui-migration.md).
