# Walking Skeleton 구현 방법 채택

- 날짜: 2026-09-27
- 맥락: `master-plan.md`에 Walking Skeleton 방법론을 추가하라는 요청.
- 변경: 더미 연습 유닛 하나의 화면 → API → 보존 → 계산 → 결과 흐름을 첫 구현으로 정의하고 이후 기능을 얇게 확장하도록 계획·시스템·검증 문서를 동기화.
- 이유: 초기 단계에서 전체 경계의 연결과 미래 데이터 비노출을 실제 사용자 흐름으로 확인하기 위해.
- 영향 stock: `docs/stock/system-design.md`의 구현 순서, `docs/validation/INDEX.md`의 첫 검증 기준.
- 검증: [Thoughtworks의 Walking Skeleton 설명](https://www.thoughtworks.com/en-th/insights/blog/first-story-every-project)과 작은 실제 종단 흐름의 취지를 대조. 계획·stock·검증 기준 일치, Markdown 23개 파일의 로컬 링크 누락 0건; 구현 검증은 없음.
- 후속 상태: 첫 경로의 상세 API·저장 계약은 구현 전 확정.
