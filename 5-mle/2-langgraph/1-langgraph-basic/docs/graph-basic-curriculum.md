# Graph Basic Curriculum

이 문서는 `graph-basic/` 예제의 학습 순서와 선행 관계를 정의하는 기준 문서입니다.
번호는 기능의 중요도가 아니라 **처음 배우는 개념의 의존 순서**를 뜻합니다.

## 설계 원칙

1. 처음 등장하는 핵심 개념은 공용 helper 안에 숨기지 않는다.
2. 한 예제에서는 새로운 핵심 개념을 한두 개만 추가한다.
3. 결정론적 예제로 그래프 동작을 먼저 익힌 뒤 LLM과 결합한다.
4. 정적 구조를 배운 뒤 동적 구조를 배운다.
5. checkpoint와 snapshot을 배운 뒤 interrupt를 다룬다.
6. 단순 subgraph를 배운 뒤 routed/hierarchical subgraph를 다룬다.

## 단계별 순서

### 1. Graph fundamentals

| 번호 | 예제 | 새 개념 |
|---:|---|---|
| 01 | `simple_graph` | `StateGraph`, node, edge, `START`, `END`, compile, invoke |
| 02 | `state_updates` | 부분 state update와 기본 overwrite |
| 03 | `reducers` | `Annotated`, reducer, 누적 state |
| 04 | `state_schemas` | state/input/output schema 분리 |
| 05 | `conditional_routing` | 결정론적 router와 conditional edge |
| 06 | `cycles_and_recursion` | cycle, 종료 조건, recursion limit |
| 07 | `command_routing` | `Command(update=..., goto=...)` |

### 2. LLM and messages

| 번호 | 예제 | 새 개념 |
|---:|---|---|
| 08 | `llm_graph` | 일반 state에서 직접 LLM 호출 |
| 09 | `messages_state` | `MessagesState`, `add_messages` |
| 10 | `structured_output` | Pydantic structured output |
| 11 | `runtime_context` | `context_schema`, `Runtime` |

### 3. Tools and agents

| 번호 | 예제 | 새 개념 |
|---:|---|---|
| 12 | `tool_schema` | `@tool`과 입력 schema |
| 13 | `tool_calls` | `bind_tools`, `AIMessage.tool_calls` |
| 14 | `tool_node` | `ToolNode`, `ToolMessage` |
| 15 | `react_tool_loop` | tool router와 ReAct cycle |
| 16 | `create_agent` | 수동 ReAct와 고수준 agent factory 비교 |

### 4. Runtime control and reliability

| 번호 | 예제 | 새 개념 |
|---:|---|---|
| 17 | `streaming` | `values`, `updates`, `messages` stream modes |
| 18 | `custom_streaming` | `get_stream_writer`와 custom events |
| 19 | `retry_policy` | 노드별 `RetryPolicy` |
| 20 | `checkpointer` | checkpoint와 `thread_id` |
| 21 | `state_snapshots` | snapshot 조회, 수정, history, replay |
| 22 | `dynamic_interrupt` | `interrupt()`, `Command(resume=...)` |
| 23 | `static_breakpoint` | `interrupt_before` 정적 중단 |
| 24 | `tool_approval` | tool 승인·거절 HITL |
| 25 | `approval_system` | 위험도 정책 기반 approval gate |

### 5. Memory and execution history

| 번호 | 예제 | 새 개념 |
|---:|---|---|
| 26 | `long_term_memory` | Store API와 사용자 namespace |
| 27 | `long_context` | 요약, sliding window, `RemoveMessage` |
| 28 | `history_reducer` | 실행 이력 reducer와 계측 |

### 6. Composition and concurrency

| 번호 | 예제 | 새 개념 |
|---:|---|---|
| 29 | `parallel_branches` | 정적 fan-out/fan-in과 join |
| 30 | `map_reduce` | 동적 `Send`와 reducer 병합 |
| 31 | `basic_subgraph` | compiled subgraph 부착 |
| 32 | `subgraph_state_schemas` | 부모·자식 state 경계와 공유 key |
| 33 | `routed_subgraphs` | 여러 subgraph 조건 라우팅 |

### 7. Application and multi-agent patterns

| 번호 | 예제 | 새 개념 |
|---:|---|---|
| 34 | `rag` | retrieve, augment, generate |
| 35 | `qa_pipeline` | citation gate와 fallback |
| 36 | `reflection` | generate/critic loop |
| 37 | `reflection_streaming` | reflection 진행 이벤트 |
| 38 | `evaluator_loop` | 구조화된 평가와 재작성 상한 |
| 39 | `verification_flow` | 결정론적 규칙 검증과 repair |
| 40 | `plan_and_execute` | structured plan과 순차 실행 |
| 41 | `supervisor` | 평면 multi-agent supervisor |
| 42 | `hierarchical_supervisor` | 팀 단위 계층형 supervisor |
| 43 | `isolated_team_state` | 팀별 격리 state |
| 44 | `reusable_chat_subgraph` | compiled subgraph 재사용 |

## 기존 번호 마이그레이션

| 기존 | 신규 |
|---|---|
| `02_llm_graph` | `08_llm_graph`, `09_messages_state` |
| `03_tool_node` | `12_tool_schema` ~ `15_react_tool_loop` |
| `04_structured_output` | `10_structured_output` |
| `05_interrupt` | `23_static_breakpoint` |
| `05_2_command_interrupt` | `22_dynamic_interrupt` |
| `05_2_custom_interrupt` | `24_tool_approval` |
| `06_checkpointer` | `20_checkpointer` |
| `07_streaming` | `17_streaming` |
| `08_map_reduce` | `30_map_reduce` |
| `09_subgraph` | `33_routed_subgraphs` |
| `10_rag` | `34_rag` |
| `11_1` ~ `11_4` | `41` ~ `44` |
| `12_1_reflection`, `12_2_reflection` | `36_reflection`, `37_reflection_streaming` |
| `13_plan_and_execute` | `40_plan_and_execute` |
| `14_parallel_branches` | `29_parallel_branches` |
| `15_long_term_memory` | `26_long_term_memory` |
| `17_configurable` | `11_runtime_context` |
| `20_history_reducer` | `28_history_reducer` |
| `21_long_context` | `27_long_context` |
| `22_evaluator_loop` | `38_evaluator_loop` |
| `23_verification_flow` | `39_verification_flow` |
| `24_qa_pipeline` | `35_qa_pipeline` |
| `26_create_agent` | `16_create_agent` |

고급 비동기 서버, semantic cache, Postgres persistence, vector database,
observability, evaluation harness, multi-tenancy는 `graph-advanced/` 확장 트랙에서 다룹니다.
