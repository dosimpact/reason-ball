# 확장 추가 버튼 배치

- 요청: 확장 기능 제목 옆에 몰려 있던 React Flow/CodeWeave 추가 버튼을 제목 아래에 배치한다.
- 변경: section-heading에는 제목만 두고, 그 아래 extension-actions에 두 버튼을 배치한다. 간격 8px, 상하 여백 12px이며 좁은 폭에서는 자연스럽게 줄바꿈한다.
- 읽기 전용에서는 액션 영역을 표시하지 않는다. 추가 동작·10개 제한·disabled 계약은 유지한다.
- 검증: Storybook AddActions의 데스크톱/좁은 폭 배치, lint 및 생산 빌드.

## 완료

- Storybook Chromium 1440px/390px/280px에서 제목 아래 두 버튼 배치·가로 넘침 없음 PASS.
- lint·생산 빌드(TypeScript 포함)·Storybook 빌드 PASS.
- 실행 중 .next를 교체하지 않도록 4000번 서버를 중지한 뒤 빌드·재시작하여 반영.
