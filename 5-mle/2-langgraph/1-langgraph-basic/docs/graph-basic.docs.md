# LangGraph Basic 예제 요약

`graph-basic/`은 한 예제에서 한두 개의 새 개념만 추가하도록 구성한 46단계
커리큘럼입니다. 상세한 선행 관계와 기존 번호 마이그레이션은
[`graph-basic-curriculum.md`](graph-basic-curriculum.md)를 참고하세요.

## 1. Graph fundamentals

- `01_simple_graph`: StateGraph, node, edge, compile, invoke.
- `02_state_updates`: 노드의 부분 update와 기본 overwrite.
- `03_reducers`: `Annotated` reducer를 이용한 누적 state.
- `04_state_schemas`: 내부 state와 input/output schema 분리.
- `05_conditional_routing`: 결정론적 router와 conditional edge.
- `06_cycles_and_recursion`: cycle, 종료 조건, recursion limit.
- `07_command_routing`: `Command(update=..., goto=...)` 동적 이동.

## 2. LLM and messages

- `08_llm_graph`: 일반 TypedDict state에서 LLM을 직접 호출.
- `09_messages_state`: `MessagesState`와 `add_messages` 누적.
- `10_structured_output`: Pydantic structured output.
- `11_runtime_context`: `context_schema`와 `Runtime` 실행별 context.

## 3. Tools and agents

- `12_tool_schema`: `@tool` 정의와 입력 schema.
- `13_tool_calls`: `bind_tools`와 `AIMessage.tool_calls`.
- `14_tool_node`: `ToolNode`가 호출 요청을 `ToolMessage`로 변환.
- `15_react_tool_loop`: router, ToolNode, cycle을 결합한 ReAct.
- `16_create_agent`: 수동 ReAct와 LangChain `create_agent` 비교.

## 4. Runtime control and reliability

- `17_streaming`: `values`, `updates`, `messages` stream modes.
- `18_custom_streaming`: 노드 내부 custom progress events.
- `19_retry_policy`: 일시 오류에 대한 노드별 RetryPolicy.
- `20_checkpointer`: `thread_id` 기반 short-term state 저장.
- `21_state_snapshots`: snapshot 조회, 수정, history, replay.
- `22_dynamic_interrupt`: `interrupt()`와 `Command(resume=...)`.
- `23_static_breakpoint`: `interrupt_before` 정적 breakpoint.
- `24_tool_approval`: tool 실행 전 승인·거절 HITL.
- `25_approval_system`: 위험도 정책 기반 approval gate.

## 5. Memory and execution history

- `26_long_term_memory`: Store API와 사용자 namespace.
- `27_long_context`: 요약, sliding window, `RemoveMessage`.
- `28_history_reducer`: 실행 이력 reducer와 node 계측.

## 6. Composition and concurrency

- `29_parallel_branches`: 정적 fan-out/fan-in과 join barrier.
- `30_map_reduce`: 동적 `Send`, worker state, reducer fan-in.
- `31_basic_subgraph`: 동일 state를 공유하는 최소 subgraph.
- `32_subgraph_state_schemas`: 부모·자식 state 경계와 공유 key.
- `33_routed_subgraphs`: 분류 결과에 따른 subgraph 라우팅.

## 7. Application and multi-agent patterns

- `34_rag`: retrieve → augment → generate 기본 RAG.
- `35_qa_pipeline`: citation gate와 fallback을 포함한 QA.
- `36_reflection`: generate/critic self-reflection loop.
- `37_reflection_streaming`: custom progress stream이 있는 reflection.
- `38_evaluator_loop`: 구조화된 평가와 재작성 상한.
- `39_verification_flow`: 결정론적 규칙 검증과 repair.
- `40_plan_and_execute`: structured plan과 순차 실행 시뮬레이션.
- `41_supervisor`: 평면 multi-agent supervisor.
- `42_hierarchical_supervisor`: 팀 단위 계층형 supervisor.
- `43_isolated_team_state`: 팀별 격리 state와 공유 interface.
- `44_reusable_chat_subgraph`: compiled chat subgraph 재사용.

## 8. Integrated capstones

- `45_research_reflexion`: 자기비평이 검색과 인용 수정을 유도하는 Reflexion.
- `46_agentic_rag`: 검색원 라우팅, 문서 평가, 답변 평가, 검색 보강 loop.

기존 `graph-lectures/`의 ReAct, Reflection, Reflexion, Agentic RAG 강의는
해당 basic 단계로 흡수되었습니다. 상세 대응표는 커리큘럼 문서를 참고하세요.

## Advanced 확장 트랙

`graph-advanced/`에서는 semantic cache, Tool+RAG, webhook resume,
graceful degradation, sandbox, Postgres persistence, vector DB,
evaluation harness, observability, async SSE, multi-tenancy를 다룹니다.
