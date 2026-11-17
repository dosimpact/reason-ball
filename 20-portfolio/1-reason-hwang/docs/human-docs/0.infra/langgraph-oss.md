# LangGraph OSS API: 개발 런타임과 운영 FastAPI의 실행 방식 맞추기

## 왜 이 작업을 하는가

현재 기존 채팅 진입점은 LangGraph 개발 런타임(`langgraph dev`, 2982)을 이용해 실제 에이전트를 실행한다. 이 개발용 채팅은 `/langgraph-dev-chat`에서 유지한다. 별도로 운영 가능한 자체 FastAPI 서버(2981)도 있지만, 같은 모양의 API가 있다는 이유만으로 두 서버가 같은 일을 하는 것은 아니다.

사용자는 현재 운영 환경에서 `langgraph dev`를 사용할 수 없으므로, 자체 FastAPI에서 LangGraph OSS를 실행하여 `/chat` 기능을 최대한 동일하게 제공하려 한다. 개발 런타임을 사용할 수 없는 구체적인 원인은 아직 확인하지 않았다. 이 문서는 그 원인을 라이선스·제품 제약·성능 문제 중 하나로 단정하지 않는다.

목표는 **동일한 에이전트 코드를 개발과 운영에서 함께 사용하고, 프런트엔드가 실행 서버의 차이를 거의 의식하지 않게 만드는 것**이다. PostgreSQL saver를 사용하는 저장 방식의 차이는 허용한다.

## 먼저 구분할 세 가지

| 이름 | 역할 | 이 프로젝트에서의 위치 |
| --- | --- | --- |
| LangGraph OSS 라이브러리 | graph, node, state, tool, checkpoint, stream 등을 제공하는 Python 실행 라이브러리 | 두 서버가 공통으로 사용할 실제 업무 실행 코드 |
| `langgraph dev` | 등록 graph를 HTTP API·SDK로 실행할 수 있게 제공하는 개발 런타임 | 현재 2982에서 동작하는 `/chat` 실행 서버 |
| 자체 FastAPI | 프로젝트가 직접 소유하는 HTTP 서버 | 2981. 라이브러리 실행과 SDK 호환 API를 직접 연결해야 함 |

따라서 LangGraph OSS를 쓴다는 것만으로 assistants/threads/runs API가 자동 완성되는 것은 아니다. 반대로 자체 API를 만든다고 graph와 업무 도구까지 다시 작성할 필요도 없다.

## 현재 구현은 어디까지 되어 있는가

아래 내용은 코드 읽기로 확인한 현재 상태이며, 이번 문서 작성 중 서버나 실제 모델을 호출하지 않았다.

| 항목 | 현재 상태 | 운영 전환에 필요한 차이 |
| --- | --- | --- |
| 등록 graph | `langgraph.json`에 10개 등록 | FastAPI도 같은 등록 목록과 실제 schema를 사용해야 함 |
| assistants API | 저장소·버전 관리와 라우트가 있음. 기본 graph schema는 3개 placeholder | 10개 graph 검색, 기본 assistant, 실제 입력 schema 연결 필요 |
| runs API | 기본 executor가 입력을 그대로 돌려주는 echo | assistant/graph를 해석해 실제 graph를 실행해야 함 |
| SSE | 실행이 끝난 뒤 metadata → values → end를 반환 | 실제 실행 중 messages·values·custom 이벤트를 바로 전달해야 함 |
| 대화·run metadata | PostgreSQL repository와 시작 시 복구 연결이 있음 | 재사용하되 실제 실행 상태와 일치시켜야 함 |
| checkpoint | saver를 주입하고 최종 상태를 수동 저장 | graph 자체에 saver를 연결해 실행 checkpoint를 저장해야 함 |
| 취소·대기열 | 상태 표시와 용량 제한을 위한 골격이 있음 | 실제 Task 취소, 동일 thread 직렬화, 실제 대기열 실행 필요 |

핵심 근거:

- [graph 등록 목록](../../../3-langgraph-fast/langgraph.json)
- [FastAPI 초기화와 PostgreSQL 연결](../../../3-langgraph-fast/src/server/server.py)
- [기본 echo executor, run 상태, 수동 checkpoint 저장](../../../3-langgraph-fast/src/server/runs/runtime.py)
- [완료 후 SSE를 만드는 runs 라우트](../../../3-langgraph-fast/src/server/runs/router.py)
- [assistants registry와 schema 라우트](../../../3-langgraph-fast/src/server/assistants/router.py)
- [PostgreSQL pool 및 saver 초기화](../../../3-langgraph-fast/src/infrastructure/postgres/checkpointer.py)

현재 HTTP 계약 테스트가 있다는 사실도 실제 graph 실행이 동일하다는 증거는 아니다. 기존 테스트에는 echo 결과나 실행을 보류하는 테스트 전용 경로를 확인하는 경우가 있다.

## 확정한 1차 범위

**운영은 단일 인스턴스·단일 프로세스로 시작한다.** 원래 메모의 “멀티 프로세스 운영 환경 설계”는 이후 확장 주제로 남긴다. 이번 단계에서 다중 worker나 여러 서버 사이의 실행 조정까지 보장하지 않는다.

1차 목표는 `/chat`이 사용하는 모든 등록 graph의 실행·스트리밍·대화 저장을 자체 FastAPI에서 제공하는 것이다.

현재 등록된 graph는 다음 10개다.

- `main_graph`, `simple_llm`
- `technical_analysis_graph`, `price_agent`, `starter_graph`, `tenk_subgraph`
- `sec_deep_agent`, `sec_modeling_agent`
- `technical_analysis_agent`, `technical_analysis_canvas_agent`

메시지 기반 에이전트뿐 아니라 `/chat`에서 JSON 입력으로 시험하는 graph도 포함한다. 각 graph의 실제 입력 schema를 따르며 모든 graph에 `messages` 입력을 강요하지 않는다.

필수 HTTP 범위는 graph/assistant 검색·schema, thread 생성·검색·상태·이력, run 생성·대기·스트림·상태 조회·취소다. crons, store API, A2A, MCP 등 나머지 API의 완전한 동등성은 후속 단계로 미룬다. 미지원 기능은 성공처럼 보이는 응답으로 숨기지 않는다.

## 목표 실행 구조

```text
FastAPI 전용 채팅(경로 제안: /fastapi-chat)
  → Host 프록시
  → 자체 FastAPI :2981
      → GraphRegistry: graph ID / assistant ID 해석
      → RunManager: Task·대기열·thread 잠금
      → 같은 Python graph + 같은 업무 도구 실행
          ├─ 실행 이벤트 → SDK 호환 SSE → OpenUI 화면
          └─ 실제 checkpoint → PostgreSQL saver
      → thread/run 검색용 metadata → 기존 PostgreSQL repository
```

### 1. graph와 업무 로직은 공유한다

`langgraph.json`의 등록 목록을 기준으로 실제 graph를 찾는다. HTTP 요청으로 임의 Python 파일 경로나 코드를 받아 실행하지 않는다.

기존 graph builder에 saver 등을 주입할 수 있는 factory 경계를 만든다. 개발 런타임에서 쓰는 기존 export는 유지하고, FastAPI는 같은 builder로 PostgreSQL saver가 연결된 실행 인스턴스를 만든다. 가격 조회·TA-Lib·SEC 도구 같은 업무 로직을 서버별로 복제하지 않는다.

기본 assistant는 등록 graph를 검색할 수 있도록 제공하고, 저장된 assistant UUID도 해당 graph로 해석한다. assistant 설정과 요청 설정의 합치는 순서를 명확하게 정해 일부 설정이 조용히 무시되지 않게 한다.

### 2. 최종 응답을 스트리밍처럼 포장하지 않는다

실제 graph의 `astream`에서 나오는 이벤트를 실행 중 전달한다. 요청한 stream mode를 반영하고, 중첩 subgraph의 namespace도 보존한다.

| 이벤트 | `/chat`이 사용하는 정보 |
| --- | --- |
| metadata | 실행을 추적하는 `run_id` |
| values | 최신 전체 state. messages, presentation 등을 snapshot으로 교체 |
| messages-tuple | 토큰 단위 메시지와 관련 metadata |
| custom | Canvas의 보고서 생성·수정·완료 이벤트 |
| error | 실행 실패. run 상태도 함께 error로 기록 |

메시지를 단순 문자열로 변환하면 tool call 정보가 사라진다. assistant의 `tool_calls` ID·이름과 tool 메시지의 `tool_call_id`·상태를 유지해야 native 도구 타임라인이 정상 동작한다. HTTP 스트림이 종료되었다는 이유만으로 run을 성공 처리해서도 안 된다.

### 3. 실제 graph checkpoint를 저장한다

서버가 검증한 thread ID를 실행 config의 `configurable.thread_id`로 전달한다. saver가 연결된 graph가 실행 중 checkpoint를 저장하도록 한다.

현재처럼 최종 결과만 수동 저장하는 방식은 graph의 reducer, 다음 실행 위치, 중간 write, 중단 상태를 충분히 대신하지 못한다. 상태·이력·수정은 graph의 `aget_state`, `aget_state_history`, `aupdate_state`를 기준으로 구현한다.

저장 책임은 다음처럼 나눈다.

- **LangGraph saver**: 실제 실행 checkpoint와 상태 복구.
- **기존 PostgreSQL repository**: assistant 설정, thread 검색 metadata, run 상태·시각 등 관리 정보.
- **RunManager 메모리**: 현재 프로세스의 Task, 잠금, 대기열과 연결된 구독자.

저장소 연결 기반은 [DB saver 설계](../../stock/tech-shared/3-langgraph-fast/3-langgraph-db-saver.md)를 재사용하되, 기존 수동 snapshot 저장과 실제 graph checkpoint 연결의 차이를 구현·문서에서 분명히 해야 한다.

### 4. 취소·동시 실행·재시작을 명확하게 처리한다

단일 프로세스 RunManager가 실행 Task와 제한된 대기열을 소유한다. 같은 thread의 두 실행이 같은 checkpoint를 동시에 수정하지 않도록 직렬화한다. 요청 취소 시 상태 문자열만 바꾸지 않고 실제 실행 Task에 취소를 전달한다. 취소 이후 늦게 도착한 결과가 run을 success로 덮어쓰지 못하게 한다.

브라우저 연결이 끊겨도 서버 실행은 계속하고 결과를 저장한다. 화면을 다시 열면 저장된 state와 완료 결과를 조회한다. 놓친 토큰 전체를 그대로 재생하는 기능은 1차 범위에 포함하지 않는다. 사용자가 명시적으로 중단하면 실제 실행 Task에 취소를 전달하되, 이미 시작된 외부 작업의 결과까지 되돌리거나 rollback한다는 보장은 하지 않는다.

프로세스가 재시작되면 대화와 완료된 checkpoint는 PostgreSQL에서 읽는다. 이전 프로세스에서 pending/running이었던 run은 interrupted로 정리하고 **자동으로 재실행하지 않는다**. 사용자 재요청 없이 외부 도구를 다시 실행하는 일을 피하기 위해서다.

## OpenUI에서 유지해야 할 계약

### 기존 인라인 기술적 분석

`technical_analysis_agent`는 기존 `presentation = {id, program}`을 반환하고 채팅 안의 OutputView가 표시한다. Canvas로 자동 전환하지 않는다.

### 별도 Canvas 기술적 분석

`technical_analysis_canvas_agent`는 서버 report UUID와 `canvas_context`를 사용한다. custom 이벤트의 원형을 유지한다.

```text
{channel:"canvas", type, reportId, payload}
open → reset → delta → validating → ready 또는 error
```

`reset`은 생성 버퍼를 바꾸고 `delta`는 프로그램 내용을 추가한다. 선택 보고서의 원래 조건·snapshot과 새 재분석 결과를 구분해야 한다. 가격·거래량·지표 데이터는 서버 계산 결과를 유지하고 AI는 허용된 배치와 설명만 작성한다.

현재 모델 공급자가 실제 토큰 스트림을 반환하지 못해 전체 결과 한 번으로 fallback하는 경우가 있다. FastAPI로 바꾼다고 공급자의 스트리밍 지원까지 자동 해결되는 것은 아니다. 실제 토큰 스트리밍과 비스트리밍 fallback을 검증 결과에서 구분한다.

### Query와 프록시

FinancialChart의 Query 조회·수동 갱신은 기존 가격/지표 GET API를 호출하며 새 LLM run을 만들지 않는다. 분석 본문은 원래 snapshot 기준이라는 표시를 유지한다.

현재 Host에는 `/api/langgraph`와 `/api/langgraph-runtime` 두 진입 경로가 있고 실행 API와 chart Query의 목적지가 나뉠 수 있다. 기존 개발용 `/langgraph-dev-chat`은 2982를 계속 사용하고, 별도의 FastAPI 채팅 화면을 추가한다. `/fastapi-chat`은 엔지니어링 경로 제안이며 최종 사용자 결정으로 확정된 이름은 아니다.

두 화면은 공통 UI에 runtime context를 주입하는 방식으로 재사용하되, 화면별 실행 요청·Query·history·thread 식별 공간을 분리한다. FastAPI 화면의 Query가 개발 서버를 호출하거나, 한 서버 실패 시 다른 서버로 자동 fallback하지 않는다. 앞서 제안한 전역 기본 서버 전환 방식은 이 별도 화면 방식으로 대체한다. 정확한 프록시 경로·설정 이름은 구현자가 이 격리를 보장하도록 정한다.

관련 코드: [Host run 전송](../../../1-fe-host/src/_pages/chat/api/chatRunApi.ts), [프록시·runtime 설정](../../stock/tech-shared/1-fe-host/open-ui.md), [Python OpenUI 계약](../../stock/tech-shared/3-langgraph-fast/open-ui.md).

## 예시: AAPL 분석부터 다음 질문까지

1. 사용자가 인라인 TA 또는 Canvas TA를 선택하고 “AAPL 일봉 60개를 분석해 줘”라고 요청한다.
2. Host는 thread를 만들고 해당 graph ID로 run을 시작한다.
3. FastAPI는 같은 Yahoo·TA-Lib 도구를 실행한다. 도구 ID와 상태가 스트림으로 전달된다.
4. graph checkpoint는 실행 중 PostgreSQL에 저장된다.
5. 인라인 TA는 `presentation`을, Canvas TA는 report UUID별 custom 이벤트를 전달한다.
6. 사용자가 차트의 조회 조건을 바꾸거나 갱신하면 Query GET만 호출한다. 분석 모델은 다시 호출하지 않는다.
7. 다음 질문은 같은 thread의 실제 저장 state를 사용한다. Canvas에서는 선택한 보고서 문맥도 함께 전달한다.

이는 목표 흐름의 예시이며 현재 FastAPI에서 이 전체 흐름이 동작한다는 실행 증거는 아니다.

## 구현 순서와 확인 기준

| 단계 | 구현할 내용 | 확인 기준 |
| --- | --- | --- |
| 1 | 공통 registry와 graph factory, 실제 schema·assistant 검색 | 같은 10개 graph가 보이고 올바른 입력 schema 제공 |
| 2 | 실제 graph 실행과 PostgreSQL checkpoint 연결 | 다음 turn에서 state 유지, 프로세스 재시작 후 대화 조회 |
| 3 | SDK SSE, native tool metadata, 인라인·Canvas 계약 | events가 실행 중 도착하고 두 UI 출력 방식 유지 |
| 4 | Task·대기열·취소·실패·재시작 정리 | 같은 thread 충돌 방지, 실제 취소, 잘못된 성공 없음 |
| 5 | 분리된 채팅 화면·runtime context와 API 회귀 검증 | 개발 채팅은 2982 유지, 새 FastAPI 채팅은 2981로 요청·Query·history 격리 |

검증은 API 수준에서 수행한다. 같은 SDK 요청을 기준으로 graph 검색, 일반 채팅, JSON graph, 인라인 TA, Canvas TA, tool 상태, 실패·취소, history와 재시작 복구를 확인한다. 모든 graph의 계약은 확인하되, 비용·외부 쓰기가 있는 도구는 안전한 fixture와 제한된 실제 실행을 구분한다. **브라우저 검증은 사용자가 직접 담당한다.**

## 2026-11-16 확정 결정: 사전 질문 답변 1~4

다음 결정은 구현 전 요구사항 확정이며, 이미 구현되었다는 뜻은 아니다. 나머지 답변 5~8은 [지표 확장 계획](../2.기술적분석/1.2.기술적%20분석추가-agent-plan.md)에 반영한다.

1. **기존 데이터**: 개발 런타임의 history/checkpoint는 새 FastAPI 저장소로 이전하지도 삭제하지도 않는다. FastAPI에서는 새 대화를 시작한다.
2. **연결 해제와 중단**: 브라우저가 끊겨도 실행·저장은 계속한다. 다시 열 때 state/완료 결과를 조회하며 유실된 전체 토큰 replay는 보장하지 않는다. 명시적 중단은 실제 취소이고 rollback은 아니다.
3. **화면 분리**: 기존 `/langgraph-dev-chat`은 개발 런타임 2982에 남긴다. FastAPI용 화면을 별도로 추가하고 공통 UI에는 runtime context를 주입한다. 요청·Query·history·thread를 격리하며 서버 간 자동 fallback은 하지 않는다. `/fastapi-chat`이라는 경로 이름은 구현 제안이다.
4. **운영 대상**: 제한된 환경의 신뢰하는 내부 사용자가 대화를 공유한다. 이번 단계에는 다중 계정별 소유권 기능을 추가하지 않는다. 인증이 이미 구현되었다고 주장하거나 공개 서비스로 노출하지 않는다. 단일 인스턴스·단일 프로세스에서 모든 `/chat` graph의 실행·stream·history를 제공한다는 1차 범위는 유지한다.

## 다음 작업과 구현자가 구체화할 사항

- 확정된 범위를 구현 단위로 나누고 API 검증 시나리오를 고정한다. 기존 dev 데이터 이전 작업은 하지 않는다.
- queue 크기·초과 응답, 명시적 취소의 Task 정리, reconnect 후 상태 조회와 stream 구독 수명은 구현자가 근거를 갖춰 정한다.
- 제한된 내부 접근 경계와 대화 공유·보존 정책을 반영한다. 다중 계정 소유권 시스템은 이번 범위에 추가하지 않는다.
- 멀티 프로세스·멀티 인스턴스는 후속 범위다. 확장 시에는 분산 실행 소유권과 큐를 별도 설계한다.
- 나머지 LangGraph API 호환은 1차 전환 결과를 확인한 뒤 우선순위를 정한다.
- 구현 세부 결정이 확정된 UX나 범위를 실질적으로 바꾸는 경우에만 변경 이유와 영향을 올린다. 이미 답변된 사항을 다시 미결정 질문으로 만들지 않는다.

이 문서는 구현 계획이다. 자체 FastAPI의 전체 API 동등성이나 향후 운영 안정성을 미리 보장하지 않으며, 기존 데이터 이전은 이번 범위에 없다.

## LG-OSS-MULTI-001: PostgreSQL 기반 여러 worker 설계

- **상태: 설계 제안, 미구현.** 현재 단일 worker 실행을 바로 변경하지 않는다. 아래 수치는 초기 제안값이며 부하·장애 검증으로 조정한다.
- 목표: Redis 없이 여러 FastAPI worker에서 graph 실행 요청·조회·취소·SSE를 처리한다. 어느 worker가 HTTP 요청을 받아도 같은 실행 상태를 보게 한다.
- 기존 `/langgraph-dev-chat`과 개발 데이터는 유지한다. `/fastapi-chat`의 graph ID, 입력, tool 메시지, OpenUI program, Canvas custom event 계약도 유지한다.
- 현재 `RunManager`의 `tasks`, `locks`, `logs`, `reserved`는 프로세스별 메모리다. `--workers`만 늘리면 실행 제한·대화 잠금·취소·스트림 공유가 깨진다.
- 현재 startup `recover()`는 pending/running을 일괄 interrupted로 바꾼다. 여러 worker에서는 다른 정상 worker의 작업까지 중단시킬 수 있으므로 반드시 교체한다.

### 1. 역할을 세 부분으로 나눈다

- **HTTP 처리**: 요청 검증, DB에 작업 접수, 상태 조회, SSE 구독을 담당한다. HTTP 연결이 끊겨도 접수된 실행은 계속한다.
- **실행 처리**: DB에서 작업을 선점한 worker만 실제 graph Task를 만든다. 이 Task 객체와 소켓은 해당 프로세스 메모리에 남는다.
- **PostgreSQL**: 대기열, 실행 소유권, 전역 용량, 취소 의도, 이벤트, 최종 결과의 공통 기준이다. 기존 saver는 graph checkpoint를 담당한다.
- 1차 확장은 각 FastAPI worker 안에 dispatcher를 하나씩 두는 방식이다. 이후 HTTP worker와 실행 전용 프로세스를 분리해도 같은 DB 계약을 재사용한다.
- 요청을 특정 worker로 고정하는 sticky session에 정확성을 의존하지 않는다. 메모리 캐시는 허용하되 실행 가능 여부·상태의 최종 판단은 DB에서 한다.

### 2. 저장해야 할 정보

- 기존 run 저장소를 조사해 필요한 열을 확장한다. 중복된 새 run 원장을 만들지 않는다. 실제 테이블명·DDL은 구현 단계에서 확정한다.
- **run**: run/thread/graph ID, 접수 순번, 검증된 입력·config·context, 실행할 graph 버전, 내부 상태, 생성·시작·종료 시각, 최종 결과·오류, 취소 요청 시각, owner ID, 실행 세대 번호, lease 만료 시각을 저장한다.
- 실행 세대 번호는 소유권이 바뀔 때 증가하는 `fencing token`이다. 과거 실행자가 늦게 돌아와 쓰는 것을 차단하는 용도다.
- **thread 실행 제어**: 현재 실행 run, 소유 세대, 대화 내 접수 순번을 관리한다. 대화당 활성 실행 하나만 허용하는 DB 제약을 둔다. state 수정·thread 삭제도 같은 제어를 따른다.
- **worker 등록**: 시작마다 새 UUID, 배포/graph 버전, heartbeat, draining 여부를 둔다. PID만으로 식별하지 않는다.
- **이벤트**: `(run_id, sequence)` 유일 키, 실행 세대, event 종류, namespace, JSON payload, 생성 시각을 저장한다. 순번은 DB 트랜잭션에서 할당한다.
- **용량 제어**: 실행 namespace별 전역 active/queued 제한과 예약 수를 DB에서 관리한다. 실행 slot 예약과 해제는 run 상태 변경과 같은 트랜잭션에서 처리한다.
- pending 검색·thread 순번·lease 만료·이벤트 cursor 조회에 필요한 인덱스를 둔다. terminal run 전체를 heartbeat마다 스캔하지 않는다.
- 요청 중복 방지 키를 제공한다. 같은 키와 같은 payload는 기존 run을 반환하고, 같은 키에 다른 payload는409로 처리한다. 키가 없는 요청까지 중복 판별한다고 보장하지 않는다.

### 3. 접수와 전역 실행 제한

- 현재 기본값인 **실행10개·대기10개를 전체 worker 합계**로 유지하는 안을 시작점으로 삼는다. worker4개라고 실행40개가 되지 않는다.
- 접수는 짧은 트랜잭션에서 전역 용량 행과 thread 제어 행을 정해진 순서로 잠그고 중복 키·대화 상태·용량을 검사한다.
- 바로 실행 가능한 요청은 active slot을 예약한다. 같은 thread의 후속 요청이나 slot이 없는 요청은 queued로 접수한다. 예약 상태도 active 용량에 포함한다.
- 모든 slot과 대기열이 차면429와 Retry-After, 같은 thread의 `reject` 요청은409다. 상태 판단과 삽입 사이 경쟁으로 한도를 넘지 않게 한다.
- 수락 응답은 DB commit 이후 반환한다. 작업 생성과 큐 등록은 같은 트랜잭션으로 처리해 접수됐지만 실행 대상으로 남지 않는 구멍을 막는다.
- 내부 queued/reserved/running/cancelling 상태를 기존 공개 pending/running/success/error/interrupted 계약에 매핑한다. 내부 상태를 곧바로 SDK 응답 enum에 추가하지 않는다.

### 4. 선점과 같은 대화 순서 보장

- dispatcher는 짧은 트랜잭션에서 `FOR UPDATE SKIP LOCKED`로 실행 가능한 작업을 선점한다. 잠긴 작업 때문에 다른 thread까지 기다리지 않도록 한다.
- 단순히 가장 오래된 pending 하나를 고르는 것으로 끝내지 않는다. **같은 thread의 가장 앞선 미처리 요청이며 활성 실행이 없는 작업**만 대상으로 한다.
- owner·실행 세대·lease·slot·thread 활성 포인터를 원자적으로 갱신한 뒤 commit하고 graph를 실행한다. LLM 호출 동안 DB transaction이나 row lock을 유지하지 않는다.
- thread별 FIFO를 보장하고 서로 다른 thread 사이에서는 가능한 오래된 작업을 우선한다. SKIP LOCKED 사용을 전체 작업의 엄격한 FIFO 보장으로 설명하지 않는다.
- 접수·선점·취소·종료·회수는 동일한 잠금 순서를 사용한다. 교착 발생 시 짧은 DB 트랜잭션만 제한적으로 재시도하고 graph 자체를 자동 재실행하지 않는다.

### 5. 소유권과 체크포인트 쓰기 보호

- 초기안은 heartbeat5초·lease30초다. DB 시각을 기준으로 갱신하고, owner와 실행 세대가 일치할 때만 연장한다. 실제 지연을 측정해 조정한다.
- 상태·이벤트·최종 결과 저장은 `run_id + owner_id + 실행 세대 + 유효 lease` 조건을 확인한다. 변경 행이0개면 소유권을 잃은 실행으로 보고 즉시 중단한다.
- **run 행만 보호해서는 부족하다.** 현재 `AsyncPostgresSaver`는 run lease를 모르므로 이전 실행자가 checkpoint/pending writes를 계속 쓸 수 있다.
- saver의 checkpoint·pending-write 쓰기에 소유권 검증을 결합하는 adapter를 설계한다. 검증과 실제 쓰기는 반드시 같은 DB 트랜잭션에서 thread 제어 행을 잠근 채 수행한다. 호출 전에 한 번 검사하는 방식은 경쟁을 막지 못한다.
- 현재 saver의 연결/트랜잭션 API로 이 원자성을 구현할 수 있는지 먼저 검증한다. 불가능하면 run별 checkpoint namespace를 분리하고 유효 owner만 결과를 게시하는 대안을 별도 설계한다. **checkpoint 보호가 검증되기 전에는 다중 worker를 활성화하지 않는다.**
- 실행 중인 thread에 대한 state 수정·삭제, transient thread 정리도 같은 제어를 통과해야 한다. 읽기·검색은 다른 worker의 오래된 메모리 snapshot이 아니라 DB/saver 기준으로 처리한다.
- DB 연결이 끊기거나 lease 갱신을 보장할 수 없으면 새 실행과 쓰기를 중단한다. 인메모리 모드로 자동 fallback하지 않는다.

### 6. 어느 worker에서든 취소한다

- 취소 API는 요청을 받은 worker가 DB에 `cancel_requested_at`을 기록한다. owner가 아닌 worker의 Task 목록에서 찾는 방식은 제거한다.
- queued/reserved이며 실행 전인 작업은 트랜잭션에서 interrupted로 종료하고 용량을 돌려준다. claim과 cancel이 동시에 와도 한쪽만 유효하게 반영한다.
- 실행 중인 작업은 소유 worker가 알림 또는 polling으로 취소 요청을 확인하고 실제 Task에 취소를 전달한다.
- 취소 요청 commit 뒤에 도착한 성공 결과는 success로 바꾸지 못한다. 반대로 이미 terminal인 run에 대한 취소는 결과를 바꾸지 않고 기존 상태를 반환한다.
- 취소 요청 접수와 실제 종료를 구분한다. 기존 API가 종료 대기를 요구하면 DB 상태를 제한 시간까지 기다리며, 지연 시 계약에 맞는 명시적 응답을 정의한다. 즉시 취소 완료처럼 표시하지 않는다.
- 외부 LLM/도구의 이미 발생한 비용·쓰기까지 rollback하지 않는다. 특히 동기 thread에서 시작한 작업은 Task 취소만으로 멈추지 않을 수 있다.

### 7. worker 장애와 재시작

- 새 worker는 다른 worker의 정상 running 작업을 건드리지 않는다. 회수기는 lease가 만료된 실행만 잠금·세대 검사 후 정리한다.
- 아직 실행되지 않은 queued/reserved 작업은 새 dispatcher가 이어서 선점할 수 있다. 실제 실행을 시작한 뒤 owner가 사라진 작업은 interrupted로 남기고 **자동 재실행하지 않는다**.
- 이는 기존 '실행된 도구를 사용자 요청 없이 반복하지 않는다' 원칙을 유지하면서, DB에 안전하게 접수된 대기 작업은 유실하지 않는 정책이다. 현재 단일 worker의 pending 일괄 interrupted 처리와 달라지는 점이다.
- lease 만료 시 이전 owner를 무효화한 후 slot을 해제한다. checkpoint 보호 없는 상태에서 같은 thread의 다음 run을 시작하지 않는다.
- 외부 부작용은 fencing만으로 되돌릴 수 없다. 결과가 불명확한 쓰기 도구가 있으면 thread를 검토 필요 상태로 막고 후속 실행을 보류한다. 도구별 멱등 키·결과 조회 또는 운영자 확인으로 해제한다.
- 정상 종료는 draining → 신규 claim 중지 → 제한 시간 동안 진행 작업 종료 대기 → 남은 작업 중단·저장 → 연결 정리 순서다.
- 여러 회수기가 동시에 돌아도 동일 run을 두 번 정리하거나 slot을 두 번 해제하지 않도록 조건부 전이와 트랜잭션으로 보호한다.

### 8. PostgreSQL로 SSE 이벤트를 공유한다

- 실행 worker는 이벤트를 DB에 commit한 다음 전달한다. 다른 HTTP worker는 run의 cursor 이후 이벤트를 읽어 기존 SSE 형식으로 보낸다.
- `LISTEN/NOTIFY`는 '새 데이터가 있으니 조회하라'는 깨우기 신호로만 사용한다. 알림에 토큰·대화 본문을 넣지 않고 run ID 등 최소 식별자만 전달한다.
- 알림은 영구 메시지 큐가 아니므로 polling을 항상 보완 경로로 둔다. listener 등록 후 cursor 조회, 알림 누락·재연결 후 재조회로 빠진 구간을 찾는다.
- 초기 polling 간격은1초, 토큰 이벤트 쓰기는 최대50ms 또는 묶음 크기 기준으로 batch 처리하는 안을 검증한다. 하나의 DB commit에 여러 event를 넣되 event 순서·tool ID·Canvas payload는 그대로 보존한다.
- `id: sequence`로 중복 전달을 식별한다. 재연결 시 보존된 범위만 이어서 읽을 수 있으며, 이전 합의대로 **모든 유실 토큰의 무제한 replay는 제공하지 않는다**.
- 활성 run에도 byte/event 상한을 둔다. 초기 보존 기준은 현재8MiB/256events·종료 후60초를 출발점으로 검증한다. 과대 단일 event와 큰 최종 state는 별도 제한·저장 정책을 정해 조용히 잘라내지 않는다.
- cursor가 삭제된 구간을 가리키면 gap을 명시하고 최신 thread state/최종 결과를 다시 조회하게 한다. Canvas delta가 빠졌다면 버퍼를 이어 붙이지 않고 완료된 presentation을 기준으로 복구한다.
- terminal 상태·최종 결과·end 이벤트는 같은 DB 트랜잭션에 저장한다. checkpoint 저장 직후 죽은 경우에도 체크포인트가 있다는 이유만으로 run을 성공 처리하지 않는다.
- HTTP 구독자가0명이어도 실행은 계속한다. polling·구독 연결 자체가 graph 재실행을 만들지 않는다.

### 9. 연결 수와 운영 설정

- FastAPI worker 수, worker별 실행 Task 상한, 전체 실행 slot 수를 별도로 관리한다. worker별 상한을 합쳐도 DB의 전역 제한을 넘을 수 없다.
- DB 연결 예산은 `worker 수 × (repository pool + saver pool + listener 연결) + 운영 여유`로 계산한다. worker를 늘리면서 각 pool을 기존 크기로 복제하지 않는다.
- LISTEN 연결은 worker당 전용 세션을 사용한다. transaction pooling 경유 연결을 listener로 재사용하지 않는다. 장시간 열린 DB transaction은 만들지 않는다.
- graph/코드 버전이 호환되는 worker만 해당 run을 선점한다. 시작 시 migration을 worker마다 실행하지 않고 배포 단계에서 한 번 수행한다.
- 조회할 지표: active/queued 수, 가장 오래 기다린 시간, lease 만료, heartbeat 지연, 취소 완료 시간, 이벤트 저장 지연·크기, SSE gap, DB pool 대기, 실패율.
- 제한된 내부 사용자 환경이라는 현재 접근 범위를 유지한다. 이벤트 저장에는 대화가 포함되므로 접근 경계·보존 기간을 metadata와 함께 관리한다.

### 10. 구현 순서와 완료 조건

- 1단계: 단일 worker 상태에서 run 저장소·접수·소유권·취소의 DB 기준 처리를 만든다. 공개 SDK 계약을 회귀 검사한다.
- 2단계: saver 쓰기 fencing, thread 수정/삭제 보호, lease 만료 처리의 원자성을 실제 PostgreSQL로 증명한다.
- 3단계: 이벤트 DB 저장·SSE cursor·알림/polling·보존 정리를 추가한다. SDK·인라인 OpenUI·Canvas payload 계약을 검증한다.
- 4단계: 서로 다른 프로세스2개로 worker A 접수/실행 → worker B 조회·SSE·취소를 검증한다. 같은 프로세스 안 Task2개로 대체하지 않는다.
- 필수 경쟁 검사: 같은 thread 동시 요청의 직렬화, 다른 thread 병행, 전체10/대기10 제한, 중복 접수 키, cancel/claim/success 경합, 중복 회수.
- 필수 장애 검사: 실행 worker 강제 종료, DB 연결 단절, lease 만료 뒤 구 owner 복귀·checkpoint 쓰기 거부, listener 단절, 느린 구독자/gap, terminal commit 직전 종료, 정상 worker 실행 중 다른 worker 재시작.
- 미실행 queued 작업만 이어서 처리되고 이미 시작한 run은 자동 재실행되지 않는지 확인한다. 외부 쓰기 도구는 fixture로 검증하고 실제 사용자 데이터를 변경하지 않는다.
- 5단계: 운영을 잠시 drain하고 구 단일 worker를 모두 내린 뒤 새 버전을 올린다. 구버전 `recover()`와 신규 worker가 같은 저장소에서 함께 실행되지 않게 한다.
- 먼저 새 DB 조정 모드의 worker1개로 검증한 뒤2개로 늘린다. worker1개로 되돌릴 때도 새 DB 모드를 유지한다. 구 메모리 런타임으로의 자동 fallback은 금지한다.
- 검증은 사용자 방침대로 API 수준에서 수행하고 브라우저 검증은 사용자가 담당한다. 코드·migration·서비스 재시작은 이번 문서 작성 범위에 포함하지 않는다.

### 설계 근거와 현재 코드

- [현재 단일 worker runtime](../../stock/tech-shared/3-langgraph-fast/fastapi-runtime.md), [RunManager](../../../3-langgraph-fast/src/server/run_manager.py), [서버 초기화](../../../3-langgraph-fast/src/server/server.py).
- PostgreSQL의 `SKIP LOCKED`는 작업 큐 소비자의 잠금 경합을 피하는 용도로 사용한다. [공식 SELECT 문서](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
- `NOTIFY`는 commit 이후 전달되며 큰 데이터는 테이블에 두고 키만 전달할 수 있다. 이를 근거로 알림과 영구 이벤트 저장을 분리했다. [공식 NOTIFY 문서](https://www.postgresql.org/docs/current/sql-notify.html).
