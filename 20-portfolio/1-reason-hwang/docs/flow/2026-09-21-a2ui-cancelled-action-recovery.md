# 취소된 모델 도구 이력과 action 재시도

- SEC-A2UI-05, A2UI-STATE-001.
- 실제 브라우저2820에서 보고서 생성 취소 후 fieldset 잠금 해제와 공시 선택 유지 확인. 즉시 재시도는 서버 JSONDecodeError로 실패했다. 정상 재시도 PASS로 처리하지 않는다.
- 원인 경계: client messages에는 중단된 구조화 도구 호출의 미완성 JSON 인자가 포함될 수 있다. action 요청은 checkpoint state로 처리할 수 있으므로 이 이력을 파싱할 필요가 없다.
- 보정: prepare_input에서 검증된 action 요청의 messages를 빈 목록으로 교체한다. checkpoint의 기존 대화는 보존하고 action/surface 검증을 그대로 수행한다. 일반 질문 요청의 이력 처리에는 이번 변경을 적용하지 않는다.
- 회귀: 미완성 FilingReport 인자를 담은 action 입력을 prepare_input→실제 LangGraphAgent.run에 전달해 정상 종료 확인. focused workflow4개 PASS.
- 남은 검증: 이 보정본 서버의 SEC 취소/즉시 재시도 브라우저 및 HTTP 재검증. 현재 preview18083은 이전 코드이며 자동 반영되지 않는다.
- Stock: 프로토콜/운영 문서에 현재 결함과 보정 검증 범위를 동기화한다.
