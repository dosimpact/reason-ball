# 검증 자원 정리 의무화

- 날짜: 2026-09-21
- 범위: tech-shared / 공통 검증 정책
- 결정 ID: VAL-CLEANUP-001
- 배경: 검증 후 Playwright MCP·Chrome CDP 관련 프로세스가 남는 문제에 대해 명시적인 정리 규칙 추가 요청을 받았다. 기존 지침은 소유 서버·임시 데이터 정리만 명시했다.
- 변경: 실행 전 소유권 기록, 성공·실패·중단 시 정리, 정상 종료 우선, 소유 PID 재확인 후 제한적 강제 종료, 임시 자원 삭제, 자식 프로세스·포트 잔존 확인, 정리 미완료 보고를 필수화했다.
- 판단 근거: 연결 해제·탭 종료와 브라우저 프로세스 종료를 구분해야 하며, 사용자 Chrome과 공유/호스트 관리 MCP 서버는 보존해야 한다.
- 영향 문서: [AGENTS](../../AGENTS.md), [검증 원칙](../validation/INDEX.md#val-cleanup-001), [브라우저 검증](../validation/business-behavior.md#browser-cleanup).
- 반영한 stock: [공통 검증 설계 / Validation resource lifecycle](../stock/tech-shared/test-design.md#validation-resource-lifecycle).
- 검증: `git diff --check`와 변경 문서의 상대 링크·신규 anchor 검사, diff 검토 PASS. 문서만 변경하므로 API E2E·Storybook·브라우저 동작 검증은 적용 대상이 아니다.
- 실행 자원: 이번 작업은 브라우저·MCP·개발 서버 또는 임시 프로필을 생성하지 않았다. 기존 실행 프로세스를 종료하는 작업은 수행하지 않았다.
