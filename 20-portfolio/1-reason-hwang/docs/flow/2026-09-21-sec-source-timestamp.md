# SEC 원문 조회 시각 보정

- 요구사항 SEC-A2UI-04: 보고서 출처 시각의 의미를 실제 처리 시점과 일치시킨다.
- 변경: BFF 원문 응답 직후 UTC 시각을 캡처한다. 원문 정규화와 모델 생성이 끝난 뒤에도 해당 조회 시각을 유지한다.
- 검증: SEC workflow 테스트에서 모델 생성 중 시계를2분 전진시켜도 보고서 출처는 최초 조회 시각을 표시하는지 검사했다. `pnpm --filter reason-hwang-langgraph-fast test tests/test_sec_a2ui_workflow.py -q` 3 PASS.
- 남은 검증: 변경을 로드한 서버의 Bruno/브라우저 검증과 wheel 재빌드. 현재 실행 중인 이전 preview는 이 변경을 자동 반영하지 않는다.
- Stock: [SEC 기술 설계](../stock/tech-shared/a2ui-system/sec.md), [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md).
