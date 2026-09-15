# 변경 이력

변경 당시의 차이·이유·영향을 보존하는 문서입니다. 현재 작업 기준은
[현재 설계 목차](../design/README.md)에서 확인합니다.

| 기록 | 내용 |
| --- | --- |
| [0001](0001-design-document-location.md) | 최초 문서 관리 위치 결정; 0003으로 대체 |
| [0002](0002-inherited-design-principles.md) | 기반 설계 원칙 도입 |
| [0003](0003-document-lifecycle.md) | 현재 설계와 변경 이력으로 문서 운영 분리 |
| [0004](0004-flow-spec-json-tree.md) | Flow Spec JSON 트리 원본과 탐색 전략 |
| [0005](0005-design-lifecycle-and-handoff.md) | 입력 보존·사용자 검토와 승인·구현 에이전트 인계 |
| [0006](0006-scope-and-type-contracts.md) | 복수 문서·scope 배지·API 공통 형식·타입별 범위 |
| [0007](0007-flow-spec-overview-detail.md) | Overview·Detail 분리와 비즈니스 핵심 호출 요약 |
| [0008](0008-mcp-storage-sse.md) | MCP·저장·SSE 기본 계약 수락 |
| [0009](0009-implementation.md) | 설계 구현·실행 기본값·검증 기반 추가 |
| [0010](0010-verification.md) | 요구사항별 검증·생산 E2E·저장 회귀 테스트 |
| [0011](0011-lan-access.md) | 명시적 LAN 접속·HTTP 브라우저 호환 |
| [0012](0012-completion.md) | 문서 관계·버전 비교·Flow 편집·Figma 연동·검증 보강 |
| [0013](0013-live-mcp-verification.md) | 실행 중인 MCP 서버 검증·추가 도구 실패·재시작 확인 필요 |
| [0014](0014-project-list.md) | 중앙 프로젝트 목록·복귀·상태 구분과 협업 UX 후속 제안 |
| [0015](0015-collaboration-ux.md) | 협업 홈·검토함·질문 답변·설계 AI 작업 지시와 승인 인계 |
| [0016](0016-startup-recovery.md) | 초기 조회와 SSE 분리·요약 실패 격리·로딩 복구 E2E |
| [0017](0017-handoff-and-evidence-ux.md) | 선택 시점 승인 버전 고정·근거 원문 탐색과 설계 비교 진행 기록 |
| [0018](0018-write-response-recovery.md) | 응답 유실 후 원래 쓰기 요청 유지·명시적 재시도·중복 방지 E2E |
| [0019](0019-usability-design-audit.md) | 최초 27개·추가 3개 요구사항과 협업 UX 최종 대조·검증 한계 |
| [0020](0020-development-server-binding.md) | 개발 서버 기본 바인딩을 `0.0.0.0:4000`으로 변경 |

## 작성 규칙


- `NNNN-topic.md`로 추가하고 이 목차에 연결합니다.
- 날짜, 상태(제안/확정/정정 등), 변경 전후, 이유, 영향받은 현재 문서, 검증 결과를 기록합니다.
- 변경된 내용만 요약하고 현재 설계 본문 전체를 복제하지 않습니다.
- 과거 기록을 최신 사양처럼 고쳐 쓰지 않습니다. 정정·대체는 새 기록으로 남기고 후속 링크를 추가합니다.
- 이 분류를 도입하기 전의 모든 대화·수정 이력을 소급 재구성하지 않습니다. 0001·0002는 기존 결정 기록을 보존한 것입니다.
