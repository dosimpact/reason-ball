# SEC 취소 직후 재시도 보정 검증

- SEC-A2UI-05, A2UI-STATE-001, VAL-BROWSER-001.
- 서버18083을 보정본으로 재시작하고 frontend2820의 새 대화에서 실제 AAPL 회사/저장 공시를 선택했다.
- 보고서 생성→중지→즉시 같은 보고서 생성 버튼 클릭을 Playwright MCP로 순차 수행했다. 기존 JSONDecodeError 없이 생성 진행 후 완료 PASS.
- 결과: fieldset 잠금 해제, 작업 완료, surface1개, 동일 공시 `0000320193-25-000079`, 요약의[E번호] 인용 표시 확인.
- 실제 source label: 원문 조회 `2026-09-20T17:22:10.789570+00:00`; 완료를 관찰한 UTC17:23:03보다 앞선 시각. 정규화220,566자/발췌24,000자 및 SHA-256 `6ae13ef3cb4f02de22048707003085785ee20c94bdc7cac5c40fe5b95b23dd7d` 표시.
- 대기 도중5초 관찰 timeout은 실행 실패로 해석하지 않고 같은 요청의 완료를 기다렸다. 콘솔 기존 favicon404 이외 오류 없음.
- 이전 취소 재시도 실패 기록은 보존하며 이 결과로 보정을 입증한다. 상위 API/모델 실패 복구 등 나머지 요구사항 검증은 별도로 남는다.
- Stock: [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md).
