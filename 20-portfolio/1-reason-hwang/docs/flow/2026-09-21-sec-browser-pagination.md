# SEC 목록·미저장 원문 브라우저 검증

- VAL-BROWSER-001, SEC-A2UI-01/02/05/06 일부.
- 환경: 최종 frontend production build2820 → 조회 시각 수정 backend18083 → 기존 BFF18101. Playwright MCP를 단독 순차 실행했다.
- AAPL 회사 조회 후 실제271개 공시의1페이지 표시 PASS.
- pending 상태의8-K/A `0001140361-26-035325` 선택: 원문 미저장 안내 및 보고서 생성 버튼 disabled PASS. 원본 `0001140361-26-015711`/수정본 관계도 표시됨.
- 공시 다음 페이지:2페이지로 전환, 선택 없음으로 초기화, surface1개 유지 PASS.
- 공시 이전 페이지:1페이지 복귀, 이전 버튼 disabled PASS.
- 검색어a로 새 회사 검색 후 다음 페이지:6320개 회사 중2페이지10행 표시, 이전 Apple 공시/선택 제거 PASS.
- 중간 테스트 selector 문법 오류는 정상 selector로 정정 후 재실행했다. 앱 오류로 계산하지 않는다.
- 남은 사항: 수정본 보고서 표시 및 취소/실패 복구 등 전체 SEC 예외 시나리오. 이번 목록 검증을 전체 완료로 간주하지 않는다.
- Stock: [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md).
