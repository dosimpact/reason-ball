# Fixed 화면 안내 갱신

- 날짜: 2026-09-21
- 요청: 기존 항공편 전용 제목·설명·예시를 새 기내식/좌석 케이스까지 포함하도록 갱신.
- 변경: 제목 “항공편 · 기내식 · 좌석 선택 · Fixed”, 조회/선택/확정 설명, 도쿄→인천 기내식·좌석 질문 예시, 채팅 환영 문구 수정. 페이지 위 별도 중복 안내 제거.
- stock: [프런트엔드](../stock/tech-shared/a2ui-system/frontend.md). 문구 원본은 features/a2ui-demo/fixed-copy.ts.
- VAL-VIEW-001: Storybook Default/Narrow(360px) 순차 실행, 2 PASS. 변경 파일 ESLint PASS, git diff --check PASS.
- API 및 업무 처리 변경 없음. 별도 API E2E 대상 아님.
- 정리: Vitest 세션 정상 종료 및 PID4529 잔존 없음 확인. 수동 개발 서버나 MCP 탭을 생성하지 않았고 사용자 자원은 유지.
