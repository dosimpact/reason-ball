# 카테고리별 catalog와 난이도 관리

- 날짜: 2026-09-21
- 배경: 사용자가 목록의 카테고리별 분리, 샘플 1개, 난이도 관리를 요청했다.
- 변경: 루트 catalog를 목차로 전환하고 daily/travel/social/work catalog를 추가했다. travel에 호텔 체크인 A2 planned 항목을 등록했다. levels.json에 7개 CEFR 코드의 이름·순서·프로젝트 작성용 설명을 정의했다.
- 이유: 1,000개 미션의 편집 범위를 나누면서 난이도는 분류와 독립적으로 관리한다. 본문 경로 기준은 assets/missions로 유지한다.
- 영향: MISSION-CATALOG-01 business/system/test stock과 README를 동기화했다. 기존 단일 빈 목록 설계를 대체하며 이전 유량 기록은 보존한다.
- 검증: JSON 파싱, 4개 목차와 분류의 일치, 하위 catalog의 schema 참조, 샘플의 분류·난이도 참조, 전체 key 유일성, 난이도 enum 일치, git diff --check.
- 제한: 샘플 본문·원격 미션은 생성하지 않았다. 난이도 가이드는 공식 CEFR 판정 기준이 아니다. 지속 실행 validator와 importer는 후속 과제다.
