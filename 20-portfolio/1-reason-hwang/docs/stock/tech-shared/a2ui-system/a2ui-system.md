# A2UI 시스템 설계

> Scope: tech-shared / 1-fe-host / 3-langgraph-fast. Status: OAuth 검증 범위 구현·검증 완료. [문서 지도](INDEX.md)와 [검증 현황](operations-and-validation.md)을 함께 읽는다.

## 목표와 범위

| ID | 요구사항 |
| --- | --- |
| A2UI-REG-001 | `1-fe-host/src/components/ui`의 61개 파일 전체를 사용 가능한 조합형 어댑터로 등록한다. |
| A2UI-CAT-001 | Zod 정의에서 결정적인 정적 카탈로그를 생성하고 React·Runtime·Python이 동일 계약을 소비한다. |
| A2UI-VER-001 | SDK·프로토콜·카탈로그 버전과 생성물 해시를 검사한다. |
| A2UI-DYN-001 | 가상 매출 데이터를 사용해 질문에 따라 UI 구조를 생성한다. |
| A2UI-FIX-001 | 사전 작성한 항공편 JSON 트리에 데이터를 바인딩한다. 실제 예약은 하지 않는다. |
| A2UI-ACT-001 | Dynamic의 `search_sales`, Fixed의 `select_flight`를 LangGraph에 전달하고 같은 surface를 갱신한다. |
| A2UI-MODEL-001 | OAuth 프록시 및 API 키 연결을 지원하며, 현재 실모델 검증 범위는 사용자 결정에 따라 OAuth로 한정한다. API 키 실모델은 미검증이다. |
| A2UI-STATE-001 | 모드·thread 상태를 격리하고 중복 실행·취소·오류를 처리한다. |
| A2UI-VAL-001 | 계약 테스트, 전체 어댑터 Storybook, Bruno HTTP E2E, MCP 브라우저와 OAuth 모델의 실증을 완료한다. |

기존 채팅, BFF, DCF 도메인은 유지하며 SEC는 기존 읽기 API 위에 A2UI 조회·분석 흐름을 추가한다. 대화는 메모리 기반이며 서버 재시작 후 복구를 보장하지 않는다. 새 DB 스키마, 실항공편 조회·예약, Intelligence 계정 연결은 범위 밖이다.

## 조사 근거와 버전

공식 문서:
- [Overview](https://docs.copilotkit.ai/langgraph-fastapi/generative-ui/a2ui)
- [Dynamic](https://docs.copilotkit.ai/langgraph-fastapi/generative-ui/a2ui/dynamic-schema)
- [Fixed](https://docs.copilotkit.ai/langgraph-fastapi/generative-ui/a2ui/fixed-schema)
- [Actions](https://a2ui.org/concepts/actions/)
- [Specification](https://github.com/a2ui-project/a2ui/tree/2d2a714dafd22590e705c32a47cd5390ab96fdc5/specification/v0_9)

| 계층 | 선택 버전 |
| --- | --- |
| CopilotKit React Core / Runtime / Renderer | 1.73.0 |
| JS AG-UI Client | 0.0.59 (Runtime의 직접 의존성과 일치) |
| JS A2UI Middleware | 0.0.10 |
| Renderer 내부 @a2ui/web_core | 0.10.4, **프로토콜 버전 아님** |
| Python copilotkit | 0.1.96 |
| Python ag-ui-langgraph | 0.0.45 |
| Zod | 3.25.76 |
| A2UI wire protocol | v0.9 |
| 검증 JSON Schema dialect | Draft 2020-12 |
| Host 카탈로그 | 1.0.0 |
| 공식 규격 commit | 2d2a714dafd22590e705c32a47cd5390ab96fdc5 |

`main`의 최신 규격을 실행 중 내려받지 않는다. v0.9.1이나 v1.0을 자동 수용하지 않는다. lockfile과 manifest에서 실제 설치 버전을 대조한다.

확인된 문서/SDK 차이:
1. Python 0.1.96은 같은 이름의 기존 도구가 있으면 자동 주입을 건너뛴다. 예외만 던지는 `generate_a2ui` 자리표시자를 복사하지 않고 `get_a2ui_tools`로 실제 도구를 등록한다.
2. `a2ui.render`는 `action_handlers` 인자를 지원하지 않는다. 사용자 이벤트 처리 경계를 직접 연결한다.
3. `extractSchema`는 일부 Zod 타입 내부 이름만 추출한다. 완전한 JSON Schema 생성기로 사용하지 않는다.
4. 기존 Chat Completions 프록시는 완성된 JSON을 반환하지만 Responses 프록시는 스트리밍을 지원한다. 기존 모델의 `disable_streaming=True`는 유지하고 A2UI 전용 모델 팩토리를 둔다.
5. OAuth Responses upstream은 typed `system` message를 거절한다. 전용 `OAuthResponsesChatOpenAI`가 이를 typed `developer` message로 바꾼다. API-key 모델과 기존 채팅에는 적용하지 않는다.
6. SDK의 기본 activity 렌더러는 메시지마다 Provider를 생성한다. 기존 surface의 후속 도구 결과를 반영하기 위해 첫 실행 전의 상위 SurfaceStreamProvider가 해당 agent의 ToolMessage/activity를 구독한다. 호출 ID별 operation batch를 한 번씩 기록하고 각 화면이 자기 surface에 순서대로 적용한다. SEC는 기본 Inline 새 ID와 고정 Canvas ID를 분리한다(SEC-A2UI-11).

## 구조와 책임

```text
components/ui (원본 React)
  -> src/lib/a2ui (정의 + 조합형 어댑터 + inventory)
  -> assets/a2ui (생성된 카탈로그 + manifest + 고정 공식 규격)
  -> Next.js CopilotKit Runtime -> HttpAgent -> FastAPI AG-UI -> LangGraph
  <- A2UI 미들웨어 <- AG-UI 이벤트 <- 도구 결과/생성 스트림
```

| 기능 | Dynamic | Fixed | SEC |
| --- | --- | --- | --- |
| 화면 | `/a2ui/dynamic` | `/a2ui/fixed` | `/a2ui/sec` |
| Host Runtime | `/api/copilotkit/a2ui/dynamic` | `/api/copilotkit/a2ui/fixed` | `/api/copilotkit/a2ui/sec` |
| FastAPI | `/ag-ui/a2ui/dynamic` | `/ag-ui/a2ui/fixed` | `/ag-ui/a2ui/sec` |
| Agent ID | a2ui-dynamic | a2ui-fixed | a2ui-sec |

`/a2ui`에서 데모와 `/a2ui/catalog` 갤러리로 진입한다. 갤러리는 메모리 부담을 줄이기 위해 선택한 어댑터 하나씩 표시한다. 브라우저는 Host의 동일 출처만 사용한다. 기본 FastAPI 주소는 `http://127.0.0.1:8000`이다. 기존 `/api/langgraph`의 기본값 2024와 혼동하지 않는다.

Runtime은 single-route POST와 `InMemoryAgentRunner`를 사용한다. 각 모드에서 `injectA2UITool: false`를 명시하고 A2UI 미들웨어는 활성화한다. Python이 도구 실행을 소유한다. 기존 표준 Runs의 입력 반환 executor를 실제 그래프 실행기로 가정하지 않는다.

## Registry와 카탈로그

정의는 원본, JSON은 생성물이다. 생성물을 수동 편집하지 않는다. 61개 파일 각각에 등록 이름, props, slot, binding, action, 대표 fixture를 대응시킨다. 훅·variant 함수·내부 Provider는 독립 생성 대상이 아니다.

- 표시 컴포넌트: 문자열·숫자·enum 등 JSON props.
- 컨테이너: child 또는 children ID로 조립한다.
- Dialog·Select·Tabs·Accordion: 내부 Trigger·Portal·Content·Provider는 어댑터가 구성한다.
- Input·Checkbox·Slider·Calendar: 로컬 데이터 모델의 읽기와 쓰기를 모두 연결한다.
- Table·Chart: React 콜백 대신 JSON 열/행/시리즈를 받는다.
- Toast: surface/component 수명으로 중복 발생을 막는다.
- Direction: 자식 트리에 방향을 적용한다.
- Sidebar·MessageScroller·Questionnaire: 필요한 실행 환경을 어댑터가 제공한다.

React 함수·ref·ReactNode·임의 render prop은 wire에 노출하지 않는다. 날짜는 ISO 문자열, 아이콘은 허용 이름, 표현은 제한된 variant로 전달한다. 컴포넌트 원본에 CopilotKit 의존성을 추가하지 않는다.

전체 Registry는 하나이며 모델에는 모드별 **정적 하위 카탈로그**를 전달한다. 각 하위 카탈로그는 별도 catalogId와 해시를 갖는다. 전체는 `reason-hwang://a2ui/host-ui/1.0.0`, 하위는 같은 prefix 아래 dynamic/fixed/sec와 버전을 사용한다. SDK 기본 카탈로그 전체를 암묵적으로 병합하지 않는다. Row·Column·Text와 필요한 도메인 표시를 명시적으로 포함한다.

`pnpm a2ui:generate`는 정렬된 JSON과 해시를 생성한다. 시간 정보는 해시 입력에 넣지 않는다. `pnpm a2ui:check`는 원본/생성물/배포 복사본/설치 버전/전체 파일 대응의 불일치를 수정 없이 검출한다. Python wheel에도 계약을 패키징한다.

## 프로토콜 검증

공식 v0.9 스키마 및 참조를 로컬에 고정한다. 프로토콜의 `catalog.json` 참조는 해당 하위 카탈로그로 해결한다. required, enum, 배열, object, 바인딩 union을 보존한다. 공식 스키마 검증과 Zod 검증의 수용/거절 사례를 비교한다.

실행 경계에서 protocolVersion, catalogId, hash를 비교한다. 알 수 없는 컴포넌트, 잘못된 props, 없는 child, 순환 참조를 거절한다. 최초 surface는 createSurface 후 구조/데이터 갱신을 허용하며, 기존 surface 갱신에 createSurface를 재발행하지 않는다. 완성되지 않은 스트림 조각은 완성 JSON으로 검사하지 않는다.

실패는 예상값/실제값을 포함한 오류로 표시한다. 빈 화면을 성공으로 처리하지 않는다. Runtime의 `a2uiToolNames: []`는 하위 모델의 미검증 중간 구조가 화면에 노출되지 않게 한다. 모델 토큰은 AG-UI로 스트리밍하지만 화면은 검증된 최종 ToolMessage에서 생성한다.

## 사용자 action과 상태

입력/선택 중 값은 React surface 데이터 모델이 소유한다. Dialog 열기나 Tabs 이동은 로컬 표현 상태다. 제출 시 path를 최신 값으로 해석해 action context로 전달한다. 서버는 action 이름과 입력을 검증하고 명시적 노드로 분기한다. 처리 결과의 원본은 LangGraph 상태다.

| action | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| search_sales | region: all/seoul/busan | 고정 매출 fixture를 필터·집계 | 기존 surface의 데이터 갱신 |
| select_flight | flightId: 등록 fixture ID | 해당 항공편 선택 상태 저장 | 기존 카드의 선택 완료 상태 |

사용자 action을 임의 Python 함수명으로 실행하지 않는다. 표시용 가격을 서버의 권위 있는 값으로 신뢰하지 않는다. action은 surface/thread/mode와 연결한다. 중복 제출 중에는 버튼을 비활성화하고 오류에서 복구한다.

`messages`에는 사용자 메시지·도구 호출·ToolMessage의 A2UI 결과가 기록된다. 토큰별 스트림을 각각 messages에 저장하지 않는다. 카탈로그와 surface 상태는 대화 이력과 구분한다. 모드별 checkpointer와 thread를 사용하고 서버 재시작 후 복구는 보장하지 않는다.

AG-UI 실행은 활성 10/대기 10, 동일 mode/thread 중복 실행 거절을 적용한다. permit은 스트림 종료까지 보유하고 취소/연결 해제/예외에서 해제한다.

## 데모와 모델

Dynamic: Vantage Threads 가상 매출 fixture, 질문별 KPI/표/위험 배지/고객 정보/원형·막대 차트. 숫자의 기준은 fixture이며 대표 질문은 결정적 계산값과 비교한다. 모델이 구성한 분석 아래 별도의 지역 조회 패널을 서버가 결합한다. 지역 선택과 조회 action은 이 패널의 매출·거래처 수·조회 상태를 갱신하며, 기존 분석 차트를 재생성하지 않는다. 화면에 이 조회 영역을 명시한다.

서버의 `facts.py`가 총 매출 $680,000, 총 쿼터 $630,000, 달성률 107.9%와 지역·월·담당자 집계를 계산한다. 생성된 Metric/InfoRow 값, Chart 데이터, Table 행은 `/facts/` 경로 바인딩을 사용해야 한다. 표시 문자열의 숫자 리터럴과 존재하지 않는 경로는 거절한다. SDK의 사전 바인딩 검사에는 모델이 반환한 데이터를 사용하지만, 최종 렌더링 전에 서버가 전체 facts 스냅샷으로 교체한다. 모델이 반환한 계산값은 저장하지 않는다. 도구 실행 후 모델의 추가 수치 답변 대신 서버의 짧은 완료 문장을 사용한다. 이 검증은 모델이 작성한 비수치 설명의 의미까지 보증하지 않는다.

Fixed: 사전 작성 JSON으로 항공편 카드를 조립한다. 공항·항공사·가격은 DynamicString 바인딩을 사용한다. 선택 action은 실제 업무 왕복을 보여주지만 예약 API를 호출하지 않는다.

서버 설정: `A2UI_MODEL_PROVIDER=oauth-proxy|api-key`, `A2UI_MODEL`, `A2UI_MODEL_BASE_URL`, `A2UI_MODEL_API_KEY`; Host는 `A2UI_LANGGRAPH_URL`을 사용한다. 모델은 기존 OPENAI_MODEL을 대체값으로 허용한다. 비밀값은 브라우저에 보내지 않는다. 두 제공자 사이의 자동 전환은 없다. 설정 오류는 데모 경계에서 드러내며 기존 서비스 시작을 불필요하게 막지 않는다.

## 검증 시나리오와 완료 기준

| ID | Given / When / Then |
| --- | --- |
| CAT-01 | 정의와 산출물이 있을 때 / check / 동일 계약 PASS, 변경된 해시·누락된 파일 FAIL |
| VER-01 | 다른 wire 버전·catalog ID / 요청·렌더 / 명시적 거절 |
| BIND-01 | 입력 fixture / 값 변경 직후 제출 / 최신 값 수신 |
| DYN-01 | 매출 데모 / 여섯 질문 유형 / 적합한 화면 및 기준 숫자 |
| ACT-01 | 매출 surface / 지역 선택·조회 / 해당 지역 데이터로 갱신 |
| FIX-01 | 항공편 카드 / 선택 / 서버 처리 후 선택 완료 표시 |
| STATE-01 | 두 모드·두 thread / 교차 실행 / 상태 혼입 없음 |
| CANCEL-01 | 실행 중 요청 / 취소·연결 해제 / 실행 permit 해제 및 다음 실행 가능 |
| MODEL-01 | OAuth 실제 모델 연결 / 생성 / 도구 호출·스트리밍·오류 전달 확인 |
| UI-01 | 전체 Registry / A2UI 경유 stories / 61개 대응 렌더링과 상호작용 검증 |

계약 단위 테스트, Storybook 실행, Bruno 실제 HTTP E2E, Playwright MCP 또는 Chrome DevTools MCP 사용자 검증을 누적 적용한다. 기존 React story 통과는 A2UI 어댑터 검증을 대체하지 않는다. 실제 모델과 통제된 fixture 증거를 분리한다. 어느 제공자의 실증이 없으면 두 방식 검증 완료로 보고하지 않는다.

순서: 버전/계약 -> Button/Input/Select/Card 최소 왕복 -> 전체 어댑터 -> Fixed/Dynamic -> 전체 검증 -> stock 동기화 -> commit. 필수 검증 미실행은 완료가 아니다.

검증은 순차 실행한다. 최신 실행별 개수, 증거와 미충족 gate는 [운영과 검증](operations-and-validation.md#확인된-증거와-남은-항목)에 통합한다. 사용자의 “지금 OAuth만 검증” 결정으로 별도 API-key 실모델 검증은 현재 완료 조건에서 제외한다. OAuth 범위 검증은 완료했으며 API-key 검증 완료를 주장하지 않는다.

Row는 콘텐츠의 최소 너비를 보장하며 줄바꿈하고 Metric 값은 중간에서 줄바꿈하지 않는다. 좁은 화면에서 숫자가 잘리지 않는지 Storybook에서 확인한다.

## 관련 문서

- [SEC 회사 조회 및 분석 보고서 A2UI](sec.md): 사용자 추가 목표. 기존 데모의 완료 조건을 대체하지 않는다.

- [공통 시스템](../system-design.md)
- [UI 목록](../1-fe-host/ui-catalog.md)
- [검증 원칙](../../../validation/INDEX.md)
- [구현 착수 기록](../../../flow/2026-09-21-a2ui-implementation-start.md)
- [계약·어댑터·실제 모델 API 검증](../../../flow/2026-09-21-a2ui-contract-and-api-validation.md)
- [브라우저 왕복과 수치 바인딩 보강](../../../flow/2026-09-21-a2ui-browser-and-grounding.md)
- [프로덕션 빌드 검증과 남은 조건](../../../flow/2026-09-21-a2ui-production-validation.md)
- [Host 구현과 운영](frontend.md)
- [LangGraph 구현과 운영](langgraph.md)


## Dynamic Fixed SEC 비교

| 항목 | Dynamic 매출 | Fixed 항공편 | SEC |
| --- | --- | --- | --- |
| 구조 결정 | 모델이 정적 카탈로그 안에서 조합 | 작성된 flight.json 트리 | 모델이 Fixed 조회 템플릿 또는 제한된 Dynamic 보고서 구성 도구 선택 |
| 데이터 | 서버의 가상 매출 facts | 서버의 가상 항공편 | 기존 BFF 회사/공시/저장 원문 |
| 모델 역할 | 도구 선택과 화면 구성 | 항공편 표시 도구 선택 | 대화 의도 판단, 조회·선택·분석·렌더 도구 선택 및 원문 발췌의 구조화 분석 |
| 사용자 action | 지역 조회 | 항공편 선택 | 검색/페이지/필터/공시 선택/보고서 |

Dynamic에서도 카탈로그는 정적이다. 매번 바뀌는 것은 허용된 컴포넌트로 조립하는 화면 트리다. Fixed에서도 데이터와 사용자 입력은 바뀔 수 있다. SEC는 모델이 대화 의도에 따라 도구를 선택하고 서버 구성 Fixed 조회 UI와 모델이 항목/순서/표현을 고른 Dynamic 보고서를 결합한다. 일반 안내는 도구 없이 답한다. 상세 범위는 [SEC-A2UI-10](sec.md#sec-a2ui-10-에이전트의-도구-선택)을 따른다.

## 추가 요구사항

| ID | 범위 | 상세 |
| --- | --- | --- |
| A2UI-CATALOG-EDIT-001 | JSON 모델 편집·실제 미리보기·초기화·오류 보존 | [React](frontend.md) |
| A2UI-PROGRESS-001 | 실제 실행 단계 SSE·취소·실패·재실행 | [이벤트](protocol-and-events.md) |
| SEC-A2UI-01~07 | 회사·공시·근거 보고서·예외·격리·검증 | [SEC](sec.md) |
