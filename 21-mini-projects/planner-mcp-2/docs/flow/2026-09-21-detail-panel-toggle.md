# 상세 패널 닫기와 다시 열기

- 날짜: 2026-09-21
- 요청: 상세 패널을 닫아 캔버스를 넓게 사용.
- 설계: 상세 영역 상단 닫기 버튼, 닫은 상태에서는 캔버스 상단 열기 버튼. 상세 패널과 크기 조절 핸들을 숨기고 캔버스를 전체 너비로 확장. 상세 컴포넌트는 유지하여 저장 전 편집 내용 보존. 다시 열면 이전 패널 비율 유지. 모바일 세로 배치에도 동일 적용.
- 검증 계획: Storybook/실제 화면에서 닫기·너비 확장·다시 열기·편집값 보존, 기존 UI 회귀.
- 상태: 구현·검증·4000번 서비스 반영 완료.
- 검증: lint·typecheck PASS. `pnpm test:e2e`에서 production/Storybook build, Bruno 23건, UI·MCP·Storybook 18건 PASS.
- UI-06: 닫기 시 캔버스 전체 너비, 핸들 숨김, 다시 열기 시 편집값·비율·포커스 복원, 모바일 닫기/열기 확인. 모바일에서 기존 Panel max-height 제한으로 콘텐츠가 겹치는 문제를 발견하여 자연 높이로 수정.
- 외부: http://dodonet.iptime.org:14000 에서 임시 프로젝트로 닫기·전체 너비·다시 열기 PASS, 임시 프로젝트 삭제 완료.
- 산출물: playwright-report/index.html, test-results/canvas-expanded.png. 원본 요구사항 변경 없음.
