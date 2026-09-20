# A2UI LangGraph 서비스

공용 계약과 버전은 [A2UI 시스템](a2ui-system.md)이 소유한다.

## 엔드포인트와 상태

- `GET /ag-ui/a2ui/manifest`: wire 버전과 카탈로그 해시.
- `POST /ag-ui/a2ui/dynamic`, `POST /ag-ui/a2ui/fixed`, `POST /ag-ui/a2ui/sec`: AG-UI RunAgentInput → SSE.

이 라우터는 기존 표준 Runs executor와 별개다. 기존 서비스의 수동 OpenAPI 문서에는 포함되지 않는다. 상세 요청 fixture는 `bruno-api-tests/13-a2ui`에 있다.

모드별 InMemorySaver를 사용하며 프로세스 재시작 후 대화를 복구하지 않는다. 클라이언트가 보낸 surfaces 상태를 신뢰하지 않고 checkpoint에서 읽는다. 계약 해시와 action 이름·surface·발신 컴포넌트·입력을 검사한다. 활성 10개와 대기 10개를 허용하며 같은 mode/thread의 중복 실행은 409, 용량 초과는 429다. 스트림 종료·취소 시 permit을 해제한다.

`workflow.py`는 생성과 사용자 action을 분기한다. Dynamic의 facts는 서버가 계산하고 모델은 구조와 허용 바인딩을 선택한다. Fixed의 항공편 트리는 `schemas/flight.json`이며 선택 상태만 변경한다. 실제 예약은 하지 않는다.

## 모델 설정

`A2UI_MODEL_PROVIDER=oauth-proxy|api-key`를 명시한다. `A2UI_MODEL`, `A2UI_MODEL_BASE_URL`, `A2UI_MODEL_API_KEY`로 전용 연결을 설정한다. API-key 모드는 placeholder를 거절한다. OAuth 모드는 Responses API의 typed system 메시지를 developer 역할로 변환한다. 자동 제공자 전환은 없다. 비밀값은 환경 또는 로컬 비추적 설정으로 관리한다.

## 순차 검증

```sh
pnpm --filter reason-hwang-langgraph-fast test
pnpm --filter reason-hwang-langgraph-fast test:a2ui:api --env-var baseUrl=http://127.0.0.1:18080
pnpm --filter reason-hwang-langgraph-fast lint
pnpm --filter reason-hwang-langgraph-fast typecheck
pnpm --filter reason-hwang-langgraph-fast build
```

실모델 검증은 패키지 디렉터리에서 연결 설정 후 `A2UI_LIVE_TESTS=1 uv run pytest tests/test_a2ui_live.py -q`로 실행한다. 기본 테스트에서는 비용이 발생하는 실모델 검증을 건너뛴다. 현재 사용자 승인 검증 범위는 OAuth만이다. API-key 실제 실행은 미검증이며 OAuth PASS로 대체하지 않는다. API E2E와 브라우저 E2E는 별도로 수행한다.

## A2UI-PROGRESS-001: 실행 진행 이벤트

Dynamic/Fixed graph는 LangChain `adispatch_custom_event`로 `a2ui.progress`를 발행하고 AG-UI가 `CUSTOM` SSE 이벤트로 전달한다. payload는 `{stage: string}`이며 `analyzing`, `composing`, `validating`, `retrying`, `delivering`, `updating`만 사용한다. Dynamic의 composing/validating은 planner 호출 전후에 발생하고 retrying은 검증 실패 후 두 번째 실제 시도에서 발생한다. 완료는 별도 stage가 아니라 RUN_FINISHED이며 실패는 RUN_ERROR다. 질문·프롬프트·내부 추론은 진행 payload에 담지 않는다.

SEC는 별도 `sec → render(ToolNode) → finish` 그래프다. 상세 구현과 원문 처리 제한은 [SEC](sec.md), 상태 소유권은 [프로토콜](protocol-and-events.md)을 따른다.
