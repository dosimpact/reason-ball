# SEC Chat 진행 타임라인 위치

- 원인: 진행 중 ActivityTimeline이 공통 프레임의 status 영역에 전달되어 채팅 헤더 위에 표시됐다. 완료 후에는 답변 메시지 안에 표시되었다.
- 변경: 진행 중 타임라인과 안내 문구를 현재 사용자 턴 다음의 임시 assistant 메시지에 렌더링한다. 완료·실패 시 기존 답변 메시지의 기록으로 전환한다.
- Stock: [SEC Chat](../stock/sec-chat.md).
- 검증: Host typecheck와 변경 파일 ESLint PASS. 지연된 응답을 사용하는 위치 회귀 E2E를 작성했다. 사용자 브라우저 검증 선호에 따라 E2E/브라우저 실행은 하지 않았다.
