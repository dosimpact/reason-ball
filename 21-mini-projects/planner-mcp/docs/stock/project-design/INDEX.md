# 프로젝트 설계 관리

Planner MCP의 현재 설계 원본입니다. 계속 유지하며 변경 시 최신 상태로 갱신합니다.
무엇이 왜 바뀌었는지는 [변경 이력](../../flow/INDEX.md)에 별도로 기록합니다.

| 문서                                                                 | 목적                                                       | 상태                |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------- |
| [00-principles.md](../tech-shared/design-principles.md)              | 현재 기술·저장·코드 작성 원칙의 원본                       | 확정                |
| [01-requirements.md](01-requirements.md)                             | 사용자, 문제, MVP 범위, 수용 기준                          | 구현 기준           |
| [02-architecture.md](../tech-shared/system-design.md)                | 구성 요소, MCP 계약, 데이터, 검증 전략                     | 구현 기준           |
| [03-document-catalog.md](03-document-catalog.md)                     | 프로젝트·문서·카탈로그 관계, 초기 타입, 시각화 및 MCP 책임 | 구현 기준           |
| [04-flow-spec.md](04-flow-spec.md)                                   | 들여쓰기 기반 코드 논리 경로, 표현 예시, 저장 및 UI 계약   | 구현 기준           |
| [05-flow-spec-tree.md](05-flow-spec-tree.md)                         | Flow Spec JSON 원본, ID, 검증, 탐색 및 인덱스              | 구현 기준           |
| [06-design-lifecycle.md](06-design-lifecycle.md)                     | 원본 입력·불확실성·검토 승인·구현 에이전트 인계            | 구현 기준           |
| [07-document-type-contracts.md](07-document-type-contracts.md)       | scope·API 공통 형식·DB·Weblogging·Figma widget 계약        | 구현 기준           |
| [08-mcp-storage-sse.md](08-mcp-storage-sse.md)                       | MCP·저장·SSE 기본 계약                                     | 상세 구현은 09 참조 |
| [09-implementation.md](../tech-shared/planner-mcp/implementation.md) | 실제 실행 기본값·코드 책임·검증 연결                       | 구현됨              |
| [10-completion.md](10-completion.md)                                 | 문서 관계·비교·Flow 편집·Figma 연동과 검증 계약            | 구현됨              |
| [11-collaboration-ux.md](11-collaboration-ux.md)                     | 프로젝트 홈·검토함·질문 답변·설계 AI 작업 지시             | 구현됨              |

## 원본 책임과 읽기 순서

- [11-collaboration-ux.md](11-collaboration-ux.md)는 프로젝트 홈·검토함·질문 답변·작업 지시의 협업 UX 원본입니다.

- 10은 로컬 추가 기능과 Figma 연동의 원본이다. 00~09에서 해당 기능을 제안·미정으로 표시한 부분은 10의 채택 범위에 한해 대체한다. 사용자 인증은 제외한다.

- 08은 MCP·저장·SSE 계약의 원본이며 구현에서 선택한 세부 기본값은 09가 원본입니다. 이전 문서의 미정 항목은 09에서 구체화한 범위에 한해 해소됩니다.

- 공통 원칙은 00, 사용자 요구·수용 기준은 01, 시스템 구성·모듈 연결은 02가 원본입니다.
- 타입 목록·문서 모델은 03, Flow Spec 문법·파서·feature 경계·UI 계약은 04가 원본입니다.
- Flow Spec JSON 모델·노드 ID·탐색・SSE 이후 접힘 상태 정책은 05가 원본입니다.
- 프로젝트 입력·설계 검토와 승인·에이전트 역할 및 개발 인계는 06이 원본입니다.
- scope와 API·DB Entity·Weblogging·Figma의 상세 작성 범위는 07이 원본입니다.
- 작업 시작 시 관련 요구사항과 상세 설계를 읽고 원칙·아키텍처를 함께 확인합니다.
- 다른 문서는 상세 내용을 복제하지 않고 원본을 요약·참조합니다.

## 작성 규칙

- 요구사항 → 아키텍처 → 구현 순서로 구체화합니다.
- 미결정 사항은 `미정`으로 표시하고, 가정은 확정 사항과 구분합니다.
- 문서 상태는 `초안`, `검토 중`, `확정`으로 표시합니다.
- 요구사항에는 `REQ-001` 형식의 식별자를 부여해 설계와 검증에서 참조합니다.
- 새 설계 문서는 `NN-topic.md` 형식으로 추가하고 이 목차에 연결합니다.
- 문서 안에서도 확정 항목과 제안을 구분합니다. 문서 전체가 초안이어도 확정 항목은 유지합니다.
- 변경 시 영향받는 현재 문서와 검증 기준을 갱신하고 `docs/flow/YYYY-MM-DD-topic.md`에 차이·이유·영향을 기록합니다.
- 변경 기록만 추가하고 현재 설계에 낡은 규칙을 남기지 않습니다.

공용 문서 템플릿 관리의 요구·계약은 [별도 도메인](../document-templates/INDEX.md)이 소유합니다.
