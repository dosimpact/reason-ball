# Planner MCP 문서 지도

현재 요구·계약은 **stock**, 결정 이유와 실행 증거는 **flow**가 원본입니다. 현재 작업에는 과거 기록을 조합할 필요가 없습니다.

## 작업별 읽기 순서

| 작업 | 읽을 문서 |
| --- | --- |
| 공통 구조·개발 시작 | [기술 지도](stock/tech-shared/INDEX.md) → [실행·환경·도구](stock/tech-shared/planner-mcp/implementation.md) |
| 프로젝트 문서·검토·인계 | [프로젝트 설계 지도](stock/project-design/INDEX.md) → 관련 상세 계약 |
| 템플릿·예시·사용 프롬프트 | [템플릿 설계 지도](stock/document-templates/INDEX.md) |
| 검증 계획·완료 판단 | [검증 원칙](validation/INDEX.md) → [검증 범위와 근거](stock/tech-shared/test-design.md) |
| 결정 배경·과거 결과 | [변경 이력](flow/INDEX.md), [초기 변경 통합본](changes/INDEX.md) |

## 문서 운영

- [사용자 요구 원본](human-input/design.md)은 사용자가 소유하며 에이전트가 덮어쓰지 않습니다.
- 공통 기술은 `stock/tech-shared/`, 업무 계약은 각 도메인에 둡니다. 상세 규칙은 담당 원본에만 쓰고 다른 문서는 링크합니다.
- 변경 시 영향받은 stock과 날짜가 있는 flow를 함께 갱신합니다. 완료된 flow는 후속 기록으로 정정합니다.
- `changes`는 0001~0020의 통합 보관본입니다. 새 기록은 flow에 씁니다. 삭제한 원문은 통합본에 적힌 Git 커밋에서 복구합니다.
- 이전 `design/` 이동 안내는 정리했습니다. 문서 진입점은 `INDEX.md`, 프로젝트 소개는 루트 `README.md`입니다.
