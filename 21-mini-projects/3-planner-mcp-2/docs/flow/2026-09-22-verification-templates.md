# 기술별 설계·검증 템플릿 추가

- 요청: React/Storybook View, 서버/Bruno API, 브라우저/Playwright MCP·Chrome CDP E2E 템플릿.
- 발견: 기존 view/api/e2e는 공통 목적/설계/검증 본문만 제공. api는 이미 revision 3이므로 기존 양식 일괄 덮어쓰기를 피함.
- 변경: 별도 이름으로 전용 양식 3개 추가. 각 본문·예시·AI 작성 지침·체크리스트 제공. settings의 버전 키로 한 번만 추가해 삭제·수정 유지. 기존 문서 snapshot은 변경하지 않음.
- stock: 템플릿 관리.
- 검증: 진행 중.

## 완료

- UI에서 세 양식 선택 → 문서 생성 → 전용 본문/snapshot 및 체크리스트 3개·AI pending/사람 미확인 초기 상태 확인.
- 전용 양식 삭제 후 실제 서버 재시작 시 미복원 확인.
- Next/Storybook 빌드·lint·단위 6/6·Bruno 25/25·Playwright 29/29 통과.
- 4000번 서비스 재시작 후 외부 `/templates`에서 전용 양식 3개 표시 확인. 기존 5개 양식의 전체 정의를 배포 전후 비교하여 변경 없음 확인.
- 실행 로그 `/tmp/planner-subtrees-templates-e2e.log`.
