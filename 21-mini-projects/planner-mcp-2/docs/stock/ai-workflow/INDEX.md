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

## MCP-only 데모와 검증 경계

- 재현 명령: 저장소 루트에서 pnpm --filter planner-mcp-2 test:mcp-demo.
- 문서 작성·수정·검증 결과 발행은 실제 Streamable HTTP MCP만 사용한다. 정형 체크리스트에는 AI 결과를, record_verification 결과 자식에는 실행 증거를 기록한다.
- 새 데모를 보존하고 별도 임시 프로젝트에서 삭제·오류 케이스를 수행한다. 기존 사용자 프로젝트는 수정하지 않는다.
- 현재 MCP는 템플릿 조회만 제공하며 사람 확인·UI 조작·프로세스 재시작 도구는 제공하지 않는다. 해당 검증은 MANUAL과 사람 미확인으로 유지한다.
- 요구사항 대응·재실행 주의·외부 데모 링크는 [MCP 종합 검증](../../validation/mcp-demo/INDEX.md)에 있다. 케이스 추적 범위와 최종 요구 충족 판정을 구분한다.
