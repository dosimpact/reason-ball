# index 진행 체크리스트 섹션 구분

- 날짜: 2026-09-21
- 요청: index 문서의 특별한 진행 체크리스트 영역을 별도 섹션으로 구분.
- 설계: 제목·안내·체크리스트·추가/편집을 하나의 이름 있는 section으로 묶고 index에만 연한 배경·강조 테두리·여백 적용. 본문 미리보기와 하위 문서 카탈로그는 섹션 밖에 유지.
- 영향 stock: 진행·검증 관리, 시스템 설계.
- 검증: Storybook 항목 있음/없음 표시 및 기존 UI 회귀 예정.
- 상태: 구현·검증·4000번 반영 완료.
- 결과: lint 및 TypeScript 포함 production build·Storybook build PASS. Bruno HTTP 23건 PASS, 기존 UI/MCP/Storybook 18건 PASS. 신규 VIEW-04는 중복 텍스트 선택자를 목록 내부로 한정한 뒤 단독 재실행 PASS (총 19개 시나리오 검증).
- 시각 확인: test-results/index-progress-section.png에서 배경·강조 테두리·항목 목록·추가/편집 영역 확인.
- 외부 확인: http://dodonet.iptime.org:14000 에서 index의 별도 체크리스트 섹션 표시 PASS. 확인용 임시 프로젝트는 삭제. 원본 요구사항 변경 없음.
