# SEC 상위 장애 복구 회귀 검사

- SEC-A2UI-05. 실서비스를 중단하지 않고 MockTransport503 및 모델 예외로 실패를 주입했다.
- 원문 API503: 기존 공시 선택 보존, 보고서 미생성, 내부 진단 본문 비노출, 보고서 버튼 재시도 가능. 장애 제거 후 같은 thread/surface에서 생성 성공.
- 모델 RuntimeError: graph가 성공으로 처리하지 않고 예외를 전달, checkpoint의 선택 공시 보존 및 보고서 미생성. 모델 복구 후 같은 thread에서 생성 성공.
- `pnpm --filter reason-hwang-langgraph-fast test tests/test_sec_a2ui_workflow.py -q`: 5 PASS.
- 검증 범위: graph/state 및 fixture HTTP 경계. 실제 브라우저의 장애 표시와 오류 경계 검증을 대체하지 않는다. 제품 코드는 이번 검사에서 변경하지 않았다.
- Stock: [운영과 검증](../stock/tech-shared/a2ui-system/operations-and-validation.md).
