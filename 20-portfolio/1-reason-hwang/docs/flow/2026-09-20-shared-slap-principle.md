# 공통 SLAP 설계 원칙 도입

- Date: 2026-09-20
- Domain: `shared`
- Decision ID: `DESIGN-SLAP-001`
- Context: SLAP을 프로젝트 공통 설계 원칙으로 명문화하고 에이전트가 작업 전에 읽도록 연결해 달라는 요청.
- Change: 공통 설계 원칙에 SLAP의 정의, 적용 기준, 코드 예시, 리뷰 기준, SRP와의 차이를 추가했다. `AGENTS.md`의 Coding and Testing Rules에서 설계·구현·리뷰 전에 해당 문서를 읽고 적용하도록 지정하고 문서 지도에 등록했다.
- Rationale: 업무 흐름과 구현 세부 사항의 혼합을 줄이되, 기계적인 함수 분리와 무관한 코드의 일괄 리팩터링을 방지한다.
- Affected stock: [공통 설계 원칙](../stock/shared/design-principles.md)의 `DESIGN-SLAP-001` 및 하위 적용·리뷰 기준.
- Related guidance: [AGENTS.md](../../AGENTS.md), [Documentation Map](../README.md).
- Validation: Python으로 추가한 상대 링크와 문서 구조·공백 검사 PASS. 대상 파일의 `git diff --check` PASS. 문서 지도 전체 링크 검사에서는 이번 변경과 무관한 `2026-09-20-sec-filing-database-content-implementation.md` 대상이 없어 FAIL로 확인했으며 해당 링크는 수정하지 않았다. 애플리케이션 실행 동작을 바꾸지 않는 문서 변경이므로 빌드·런타임 테스트는 생략한다.
- Follow-up: 이후 코드 설계·구현·리뷰에서 `DESIGN-SLAP-001`을 적용한다.
