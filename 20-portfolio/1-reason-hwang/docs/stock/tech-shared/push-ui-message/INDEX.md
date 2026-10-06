# Push UI message 예제 설계

## PUSH-UI-001: 턴별 진행 부가정보

`/examples/push-ui-message`는 기존 chat/A2UI와 분리된 일시적 학습 예제다. 사용자와 LLM이 대화하며 LLM이 선택한 도구 호출과 답변 준비 상태를 각 assistant 메시지에 누적 표시한다. 비공개 chain of thought를 생성하거나 노출하지 않는다.

- Backend: `graph/primary_graphs/simple_push_ui_message`; model → tools → model 반복. `ui_message_reducer`와 `push_ui_message(message=AIMessage(id=turn_id))` 사용.
- 각 단계는 고유 UI ID를 가진다. 시작 이벤트는 append, 완료/실패 이벤트는 동일 ID와 merge=True로 갱신한다. 서로 다른 턴의 항목은 섞이지 않는다.
- Tools: 로컬 예제 자료 검색, 고정 매출 데이터의 지역별 집계. 외부 검색/실제 운영 DB 조회로 표시하지 않는다. LLM이 도구를 선택한다; 일반 대화에는 불필요한 도구를 강제하지 않는다.
- Transport: POST `/examples/push-ui-message/stream`; custom UI + 최종 assistant 이벤트의 SSE. 프런트는 전용 same-origin proxy를 사용한다.
- Frontend: `features/push-ui-message/`에 transport, controller, pure view를 분리한다. 대화는 브라우저 메모리만 유지하며 최근 대화 텍스트를 다음 요청에 전송한다. 기존 chat은 변경하지 않는다.
- 제한: 최대 20개 이전 메시지, 메시지당 4000자, 도구 반복 제한, 모델 timeout, 취소/실패 상태 명시. 재연결/영구 저장/운영 DB 쓰기는 범위 밖.

## 검증 시나리오

1. 일반 질문 → 답변 및 해당 턴의 완료 상태.
2. 자료 검색과 매출 조회 요청 → 실제 도구 시작/완료 이벤트, 답변, 데모 출처 표시.
3. 연속 두 턴 → 이전 턴의 진행정보 보존, 새 턴에 독립 이벤트.
4. 취소/네트워크 실패 → 오류 또는 취소 표시, 다음 요청 가능.
5. API 잘못된 입력 거절; Storybook 진행/실패/완료 상태; 실제 브라우저 사용자 흐름.

[공식 API](https://reference.langchain.com/python/langgraph/graph/ui/push_ui_message) · [Flow](../../../flow/2026-10-02-push-ui-message-example.md)

## 실행 및 검증 명령

```sh
pnpm --filter reason-hwang-langgraph-fast dev
pnpm --filter reason-hwang-fe-host dev
pnpm --filter reason-hwang-fe-host test:push-ui
pnpm --filter reason-hwang-fe-host test:push-ui:views
pnpm --filter reason-hwang-langgraph-fast test:push-ui:api --env-var baseUrl=http://127.0.0.1:8000
```

Python 단위 검사는 패키지 안에서 `uv run python -m pytest tests/test_push_ui_message_example.py -q`를 사용한다. 모델 factory는 기존 A2UI 모델 설정·OAuth 호환 처리를 재사용한다. 진행 이벤트만 실행 중 전송하며 최종 답변은 완료 시 전송한다.

현재 상태: 구현 및 격리 테스트 통과. 2026-10-02 앱 재시작 후 실제 브라우저에서 도구 호출, 두 턴의 진행정보 분리 및 최종 답변을 확인했다. API Bruno·Storybook 검증은 실행 환경 제한으로 미완료다. 후속 증거는 [앱 재시작 기록](../../../flow/2026-10-02-dev-port-restart.md)에 있다.
