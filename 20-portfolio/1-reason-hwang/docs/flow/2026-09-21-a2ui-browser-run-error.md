# AG-UI RUN_ERROR 브라우저 처리

- A2UI-STATE-001, SEC-A2UI-05 일부, VAL-BROWSER-001.
- Playwright MCP의 일회성 route로 실제 요청 threadId/runId를 유지한 RUN_STARTED→RUN_ERROR SSE fixture를 응답했다. HTTP200 내부 실행 오류 처리 검증이다.
- 오류 메시지 `검증용 서버 실행 오류`, 작업 실패, surface1개 유지, 입력 잠금 해제 PASS.
- 알림 닫기 후 실제 서버로 같은 공시 필터 action 재전송: 작업 완료/입력 활성/오류 제거 PASS.
- 이 검사는 renderer/subscriber의 SSE 오류 처리 증거다. 실제 BFF503 또는 provider 장애를 end-to-end로 발생시켰다는 뜻은 아니다. 서버 내부 실패 복구는 별도 graph 검사와 합쳐 범위를 판단한다.
- Stock: [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md).
