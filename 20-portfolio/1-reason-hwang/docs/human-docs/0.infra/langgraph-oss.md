# LangGraph OSS API: 개발 런타임과 운영 FastAPI의 실행 방식 맞추기

작성 기준: 2026-11-16. **이 문서는 구현 전 설계다. 아래 목표가 이미 구현되었거나 검증되었다는 뜻은 아니다.**

## 왜 이 작업을 하는가

현재 `/chat`은 LangGraph 개발 런타임(`langgraph dev`, 2982)을 이용해 실제 에이전트를 실행한다. 별도로 운영 가능한 자체 FastAPI 서버(2981)도 있지만, 같은 모양의 API가 있다는 이유만으로 두 서버가 같은 일을 하는 것은 아니다.

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
/chat
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

브라우저 연결 해제와 서버 실행 취소는 같은 의미가 아니므로 정책을 명시한다. 또한 취소 요청이 이미 시작된 외부 작업의 결과까지 되돌린다는 보장은 하지 않는다.

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

현재 Host에는 `/api/langgraph`와 `/api/langgraph-runtime` 두 진입 경로가 있고 실행 API와 chart Query의 목적지가 나뉠 수 있다. 주소 하나만 바꾸어 전환이 끝났다고 판단하면 안 된다. 목표는 실행 API와 Query API가 **하나의 명시적인 서버 선택 설정**을 따르게 하는 것이다. 프록시 경로를 없앨지 호환 alias로 유지할지는 구현 시 정하되, 서로 다른 서버로 조용히 분기하지 않게 한다.

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
| 5 | Host 서버 선택 설정 정리와 API 회귀 검증 | 2981로 전환해도 `/chat`의 필수 동작 유지 |

검증은 API 수준에서 수행한다. 같은 SDK 요청을 기준으로 graph 검색, 일반 채팅, JSON graph, 인라인 TA, Canvas TA, tool 상태, 실패·취소, history와 재시작 복구를 확인한다. 모든 graph의 계약은 확인하되, 비용·외부 쓰기가 있는 도구는 안전한 fixture와 제한된 실제 실행을 구분한다. **브라우저 검증은 사용자가 직접 담당한다.**

## 다음 작업과 아직 결정하지 않은 사항

- 위 범위를 구현 단위로 나누고 API 검증 시나리오를 먼저 고정한다.
- 기존 개발 런타임의 대화·checkpoint를 새 PostgreSQL 저장소로 옮길지는 **미결정**이다. 자동 이전이 구현되었거나 호환이 보장된다고 가정하지 않는다.
- 연결 해제 시 실행 유지/취소, 대기열 크기와 초과 응답, 필요한 stream 재연결 보장 범위를 확정한다.
- 운영 인증·접근 경계와 데이터 보존 정책을 구현 계획에 반영한다.
- 멀티 프로세스·멀티 인스턴스 운영은 후속 범위다. 확장 시에는 프로세스 내부 잠금만으로 충분하지 않으므로 분산 실행 소유권과 큐를 별도 설계한다.
- 나머지 LangGraph API 호환은 1차 `/chat` 전환 결과를 확인한 뒤 우선순위를 정한다.

이 문서는 구현 계획이다. 자체 FastAPI의 전체 LangGraph API 동등성, 기존 데이터 이전, 향후 운영 안정성을 미리 보장하지 않는다.
