# 미션 작성 카테고리와 catalog

- 날짜: 2026-09-21
- 배경: 약 1,000개 미션 JSON 작성에 앞서 사용자가 분류와 index/catalog 구성을 요청했다.
- 변경: `assets/missions/`에 categories.json, 빈 catalog.json, catalog.schema.json과 README를 추가했다.
- 이유: 기존 앱의 일상·여행·관계·업무를 유지하고 24개 세부 분류로 확장한다. 작성 전 planned 항목과 본문 경로를 분리해 기획 단계부터 관리한다.
- 결정: key는 전역 고유·불변, ready는 로컬 검토 완료이며 원격 게시가 아니다. 본문·분류 불일치는 이후 importer에서 오류로 처리한다.
- 영향: MISSION-CATALOG-01을 business/system/test stock에 반영했다. 앱·DB 변경은 없다.
- 검증: Node로 세 JSON 파싱, schemaVersion, 초기 catalog가 비어 있음, 대분류 4개·세부 분류 24개 및 ID 유일성 확인. `git diff --check` 확인.
- 후속: 본문 스키마, 교차 참조 검사 도구, CEFR 변환, 원격 importer는 미구현이다. 예시 미션을 실제 데이터로 등록하지 않았다.
