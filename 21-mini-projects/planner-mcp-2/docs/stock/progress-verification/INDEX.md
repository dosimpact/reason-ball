# 진행·검증 관리

상태: 핵심 기능 구현. [MCP·REST 계약](../tech-shared/interfaces.md)에서 입력과 도구 목록을 확인합니다.

- 식별자: `progress-verification`
- 책임: 정형 체크리스트, AI 검증 결과, 사람 확인 상태, 선택적 reopen 관리.
- 근거: [시스템 설계의 DEC-001](../tech-shared/system-design.md), [통합 비즈니스 설계](../project-design/business-design.md).

- index 문서의 진행 체크리스트는 독립 섹션으로 표시합니다. 제목·단계 안내·항목 목록·추가/편집 기능을 강조 테두리와 연한 배경 안에 묶어 본문 및 하위 문서 카탈로그와 구분합니다.

- 사람은 AI 결과가 pending인 검증 전에도 체크·해제할 수 있습니다. AI 결과와 사람 확인은 독립적으로 유지하며, AI 결과 변경만으로 사람 확인을 초기화하지 않습니다. 항목 설명 변경·명시적 reopen은 기존대로 확인을 초기화합니다. 문서 verified는 모든 항목이 AI passed 및 사람 확인인 경우입니다.
