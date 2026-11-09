# 2026-11-08 OpenUI 통합 마이그레이션 착수

- 요구사항: OPENUI-MIG-001. 기준 PoC 6-a-2, 최종 출력 서브그래프, CopilotKit 제거, 네 화면 및 action 유지.
- 변경: SEC의 OpenUI 생성 로직을 공통 출력 서브그래프로 분리하고 기존 compose_ui 호출을 연결했다. 프롬프트 동기화 목적지를 공통 모듈로 변경했다.
- 이유: 업무 처리와 UI 표현의 소유권을 분리하고 이후 화면 이전에서 공통 출력을 재사용한다.
- stock: [현재 상태](../stock/tech-shared/openui-migration.md).
- 검증: `3-langgraph-fast`에서 `uv run pytest tests/test_sec_intelligent_ui.py tests/test_sec_admin_chat.py -q`: 25 passed (4.53s). Bruno·Storybook·MCP·실모델 검증 미실행. 전체 마이그레이션 미완료.
- 자원: 서버·브라우저를 생성하지 않았다. 기존 사용자 변경과 PoC 런타임 파일은 수정하지 않았다.
