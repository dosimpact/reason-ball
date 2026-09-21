# AI 작업 안내

상태: 핵심 기능 구현. [MCP·REST 계약](../tech-shared/interfaces.md)에서 입력과 도구 목록을 확인합니다.

- 식별자: `ai-workflow`
- 책임: 작업 규칙, 문서 탐색 방법, 구현·검증 절차 제공.
- 근거: [시스템 설계의 DEC-001](../tech-shared/system-design.md), [통합 비즈니스 설계](../project-design/business-design.md).

## REQ-010 도구 안내

- sidebar 하단에 항상 보이는 AI MCP Interface 안내 링크로 `/mcp-guide`에 이동합니다.
- 현재 배포된 서버의 도구 이름·설명·필수/선택 입력·JSON Schema와 MCP 연결 경로를 표시합니다. 이름·설명 검색을 지원합니다.
- 기존 `@modelcontextprotocol/sdk`의 Client·InMemoryTransport로 `tools/list`를 읽습니다. 별도 목록 복사 없이 등록 변경이 배포 후 페이지 조회에 반영됩니다.

- MCP 파라미터는 이름·필수 여부·타입 요약을 우선 보여주고 전체 JSON Schema를 펼쳐봅니다.

- 검색 아래에 기본 접힘 상태의 도구 목차를 제공합니다. 현재 검색 결과로 목차를 자동 생성하며 항목 클릭 시 해당 도구 설명으로 이동합니다. 검색 결과가 없으면 목차를 숨깁니다.

- 헤더의 Planner 로고는 메인(`/`) 링크입니다. 현재 프로젝트 선택을 해제하고 작업 공간 첫 화면으로 돌아갑니다. 미저장 편집은 기존 이탈 확인으로 보호합니다.
