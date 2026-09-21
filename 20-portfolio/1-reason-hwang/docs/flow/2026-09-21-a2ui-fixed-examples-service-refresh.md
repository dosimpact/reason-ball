# Fixed 예시 통합과 실행 서비스 갱신

- 날짜: 2026-09-21
- 사용자 요청: 별도 추가 안내 대신 기존 예시 영역에 기내식/좌석 예시를 이어 붙이기. 이어서 기내식만 요청했는데 통합 UI가 나온다고 보고.
- 코드: 기존 인천→도쿄·부산→오사카 예시 유지, 기내식만·좌석만·함께 선택 예시 추가. 설명을 각각 또는 함께 선택으로 수정. 별도 추가 데모 배너는 이미 소스에서 제거되어 있었음.
- 원인: 실제2820 GET은 이전 제목/추가 배너를 반환했다. 최신 코드를 테스트용 서버에서만 검증하고 실제 사용자 서비스2820/18083 갱신이 누락된 상태였다.
- 조치: 기존 대상 프로세스/명령 확인 후 backend18083(PID98821) 종료 및 최신 Python 재시작. 프런트는 기존 서버를 유지한 채 .next-fixed-ui-current로 production build PASS(16 route/타입 검사), 이후2820(PID99261)을 새 빌드로 교체. OAuth2890/gpt-5.6-luna 및 SEC BFF18101 설정 유지.
- VAL-VIEW-001: fixed-copy Storybook Default/Narrow 2 PASS. build PASS, git diff --check PASS.
- VAL-BROWSER-001: Playwright MCP로 실제 http://localhost:2820/a2ui/fixed 확인. 새 제목·설명, 기존2개+추가3개 예시, 추가배너0개. “도쿄에서 인천 항공편의 기내식만 선택하고 싶어” 실제 OAuth 요청 → 작업 완료, 기내식 그룹1개/좌석 그룹0개 PASS.
- 정리: 검증 MCP 탭 종료(No open tabs), Storybook PID7596 잔존 없음. Next 자동 변경 tsconfig/next-env 복원. 사용자용2820/18083과 해당 생산 빌드는 유지 대상이며 임시 검증 서버가 아니다. 기존 중지 대상 PID98821/99261 종료 확인. 기타 사용자 자원 보존.
- stock: [프런트엔드](../stock/tech-shared/a2ui-system/frontend.md). 사용자 확인 시 강제 새로고침 후 새 대화 권장. Python 재시작으로 이전 in-memory 대화 상태는 복구되지 않음.
