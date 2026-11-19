# SEC 화면 이탈 자동 abort 제거

- SEC-NAV-ABORT-001: 사용자가 unmount의 `abort.current?.abort()` 제거를 요청했다.
- 변경: SecChat의 unmount cleanup effect 한 줄 삭제. 명시적 답변 중단 버튼과 실패 안내 timeout은 유지한다. 서버 API 변경 없음.
- stock: [Host SEC](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md#sec-nav-abort-001-화면-이탈-시-자동-취소-제거).
- 예상 시나리오: SEC 응답 진행 중 앱 내부의 다른 화면으로 이동할 때 unmount가 fetch signal을 abort하지 않는다. 명시적 답변 중단은 기존처럼 동작한다.
- 검증: Host typecheck 및 변경 파일 ESLint PASS. VAL-BROWSER-001은 Playwright MCP가 기존 프로필 사용 중 오류를 반환하여 미완료. Chrome 종료 시 작업 지속/복원은 검증하거나 보장하지 않는다.
- 자원: MCP가 브라우저 생성 전에 실패하여 작업 생성 브라우저/서버 없음. 기존 브라우저와 사용자 human-docs 변경 보존. 브라우저 검증 후 완료 판단 필요.
