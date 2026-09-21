# A2UI LangGraph 서비스

공용 계약과 버전은 [A2UI 시스템](a2ui-system.md)이 소유한다.

## 엔드포인트와 상태

- `GET /ag-ui/a2ui/manifest`: wire 버전과 카탈로그 해시.
- `POST /ag-ui/a2ui/dynamic`, `POST /ag-ui/a2ui/fixed`, `POST /ag-ui/a2ui/sec`: AG-UI RunAgentInput → SSE.

이 라우터는 기존 표준 Runs executor와 별개다. 기존 서비스의 수동 OpenAPI 문서에는 포함되지 않는다. 상세 요청 fixture는 `bruno-api-tests/13-a2ui`에 있다.

모드별 InMemorySaver를 사용하며 프로세스 재시작 후 대화를 복구하지 않는다. 클라이언트가 보낸 surfaces 상태를 신뢰하지 않고 checkpoint에서 읽는다. 계약 해시와 action 이름·surface·발신 컴포넌트·입력을 검사한다. 활성 10개와 대기 10개를 허용하며 같은 mode/thread의 중복 실행은 409, 용량 초과는 429다. 스트림 종료·취소 시 permit을 해제한다.

`workflow.py`는 생성과 사용자 action을 분기한다. Dynamic의 facts는 서버가 계산하고 모델은 구조와 허용 바인딩을 선택한다. Fixed의 항공편 트리는 `schemas/flight.json`이며 선택 상태만 변경한다. 실제 예약은 하지 않는다.

Fixed 샘플은 인천(ICN)↔도쿄(NRT), 인천↔오사카(KIX), 부산(PUS)↔오사카, 인천↔방콕(BKK), 인천↔싱가포르(SIN)의 양방향 총 10편이다. 항공사와 가격은 가상이며 실시간 검색을 하지 않는다. 없는 노선은 데모 데이터 부재임을 안내하고 실제 운항 불가로 단정하지 않는다. 도시 이름은 위 샘플 공항으로 해석하되 명시된 공항 코드와 요청 방향을 따른다. Fixed의 도구 호출 없는 텍스트 안내/추가 질문은 정상 종료하며 기존 surface를 보존한다. 도구 호출이 있었는데 surface 생성에 실패한 경우와 Dynamic의 무출력은 계속 오류로 처리한다.

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

## CABIN-01: 기내식·좌석 Fixed 데모

기존 항공편 선택과 같은 Fixed 화면/endpoint에서 별도 `display_cabin_options(flight_id, ui_type)` 도구 하나로 고정 UI를 선택한다. `ui_type`은 `meal | seat | both`이며 기본값은 `both`다. 기내식만 요청하면 meal, 좌석만 요청하면 seat, 둘 다 요청하면 both를 모델이 선택한다. 항공편 카드의 `display_flight`는 유지한다. 기내식 또는 좌석 요청에는 새 도구만 호출하며 특정 항공편이 없으면 인천→도쿄 샘플을 표시한다.

고정 구조는 허용 목록에 등록된 `schemas/meal.json`(기내식), `schemas/seat.json`(좌석), `schemas/cabin.json`(통합)이며, 데이터·선택 검증은 `cabin.py`가 소유한다. 일반식/채식/어린이식/없음과 좌석 12A/12B/12C/14A/14C 중 선택한다. 초기값은 일반식·12A이며 확정 전 RadioGroup이 로컬 데이터 모델을 수정한다. `confirm_cabin` action은 서버 checkpoint의 카드·항공편과 해당 UI에 노출된 선택 값만 검증한다. UI 종류는 서버 checkpoint의 uiType을 기준으로 하며 화면에 없는 선택 값이나 클라이언트가 보낸 uiType은 거절한다. 성공하면 동일 surface의 요약을 갱신하고 입력·버튼을 잠근다. 같은 확정의 재전송은 허용하고 다른 값으로 바꾸는 재전송은 거절한다. 다른 카드 상태는 바꾸지 않는다.

실제 좌석 재고, 결제, 예약, 알레르기 요구 보장, 특별식 제공 보장은 범위 밖이다. 새 선택을 하려면 새 카드를 요청한다. Fixed 카탈로그는 RadioGroup을 포함하며 전용 action 계약은 select_flight/confirm_cabin만 허용한다.

새 카탈로그 적용에는 Host와 Python을 함께 재시작해야 한다. 검증 전용 서버는 종료했다. 동일 환경에서 재현하려면 각각 별도 터미널에서 다음을 실행한다.

```sh
A2UI_MODEL_PROVIDER=oauth-proxy A2UI_MODEL=gpt-5.6-luna A2UI_MODEL_BASE_URL=http://127.0.0.1:2890/v1 pnpm --filter reason-hwang-langgraph-fast start --host 127.0.0.1 --port 18084
A2UI_LANGGRAPH_URL=http://127.0.0.1:18084 NEXT_DIST_DIR=.next-cabin-dev pnpm --filter reason-hwang-fe-host dev --port 2821
```

브라우저 `http://localhost:2821/a2ui/fixed`에서 “도쿄에서 인천 항공편의 기내식과 좌석을 선택하고 싶어”를 입력한다. 검증 결과는 [기내식·좌석 검증 기록](../../../flow/2026-09-21-a2ui-cabin-validation.md)에 있다.

CABIN-03: 단일 도구의 UI 선택 인자와 개별 확정 검증은 [UI 종류 확장 기록](../../../flow/2026-09-21-a2ui-cabin-ui-types.md)을 따른다.
