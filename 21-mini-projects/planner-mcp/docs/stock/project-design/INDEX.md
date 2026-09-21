# 프로젝트 설계 관리

현재 범위는 [요구사항](01-requirements.md)의 REQ-001~030입니다. 공통 구조·실행은 [기술 지도](../tech-shared/INDEX.md), 별도 템플릿 기능은 [템플릿 도메인](../document-templates/INDEX.md)을 따릅니다.

## 상세 계약의 원본

| 주제 | 원본과 책임 |
| --- | --- |
| 요구와 수용 기준 | [요구사항](01-requirements.md) |
| 프로젝트·문서·7종 타입 | [문서 카탈로그](03-document-catalog.md) |
| Flow 표현·파서·viewer | [Flow 문법과 화면](04-flow-spec.md) |
| Flow JSON·ID·탐색 | [트리 모델](05-flow-spec-tree.md) |
| 원본 입력·검토·승인·고정 버전 인계 | [설계 생명주기](06-design-lifecycle.md) |
| scope·API·DB·이벤트·Figma widget | [타입별 계약](07-document-type-contracts.md) |
| 충돌·중복 방지·외부 변경·실시간 조회 | [MCP·저장·SSE](08-mcp-storage-sse.md) |
| 관계·비교·Flow 편집·Figma 수집·프로젝트 목록 | [확장 기능](10-completion.md) |
| 프로젝트 홈·검토함·질문 답변·AI 작업 지시 | [협업 UX](11-collaboration-ux.md) |

요구사항을 읽은 뒤 변경할 주제의 원본을 확인합니다. 문서 번호는 기존 링크를 유지하기 위한 식별자이며 읽기 순서나 우선순위가 아닙니다. 현재 계약은 위 문서에 반영하며 변경 배경은 [flow](../../flow/INDEX.md)에 기록합니다.
