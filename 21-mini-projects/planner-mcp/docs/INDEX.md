# Planner MCP 문서 지도

문서는 공용 → 구체 순서로 읽습니다. 현재 상태의 원본은 stock이며 flow는 변경 이유와 검증 이력입니다.

1. [공통 기술 지도](stock/tech-shared/INDEX.md): 설계 원칙, 구조, 실행 기본값.
2. 관련 도메인: [프로젝트 설계 관리](stock/project-design/INDEX.md), [문서 템플릿 관리](stock/document-templates/INDEX.md).
3. [검증 원칙](validation/INDEX.md)을 적용하고 필요할 때 [변경 이력](flow/INDEX.md)을 확인합니다.

## 원본과 이력

- [사용자 요구 원본](human-input/design.md)은 사용자가 소유합니다. 에이전트는 덮어쓰지 않습니다.
- stock에는 현재 요구·계약·설계를 동기화하고, 날짜가 있는 flow에 결정 이유·영향 stock·검증 결과를 기록합니다.
- [기존 변경 이력](changes/README.md)은 당시 상태를 보존합니다. 새 기록은 flow에 작성합니다.
- design의 이전 경로는 이동 안내로 유지합니다. 역사 기록의 링크는 해당 안내로 현재 원본을 찾습니다.
- docs 하위 문서 진입점은 INDEX.md입니다. 프로젝트 루트 README.md는 소개용입니다.
