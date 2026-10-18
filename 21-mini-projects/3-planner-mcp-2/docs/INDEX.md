# 설계 문서 지도

상태: 5개 도메인의 핵심 기능 구현. 시스템 설계와 MCP·REST 계약, 검증 시나리오를 연결합니다.

- [원본 요구사항](../master-requirement.md)
- [사용자 입력](human-input/INDEX.md)
- [비즈니스 설계](stock/project-design/business-design.md)
- [공통 기술 지도](stock/tech-shared/INDEX.md)
- [검증 문서](validation/INDEX.md)
- [변경 이력](flow/INDEX.md)

stock에는 최신 합의 내용을 유지하고, flow에는 날짜별 변경 이유와 검증 결과를 추가합니다.

## 도메인 기능 (DEC-001)

- [프로젝트 관리](stock/project-management/INDEX.md)
- [템플릿 관리](stock/template-management/INDEX.md)
- [문서 관리](stock/document-management/INDEX.md)
- [진행·검증 관리](stock/progress-verification/INDEX.md)
- [AI 작업 안내](stock/ai-workflow/INDEX.md)

## 독립 모듈

- [CodeWeave core](stock/codeweave/INDEX.md) — npm 패키지 분리를 고려한 파서·트리·조회·수정. Next.js 문서 확장·MCP 어댑터 연결 완료.
