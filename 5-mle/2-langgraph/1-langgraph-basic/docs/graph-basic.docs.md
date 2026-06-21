# LangGraph 예제 요약

각 예제별 핵심 기능을 3줄로 정리.

---

## `graph-basic/` — 기본 패턴

### 01_simple_graph
- LLM/tool 없이 일반 함수 노드 두 개를 직선으로 연결한 "Hello, LangGraph" 예제.
- `StateGraph` + `TypedDict` 로 커스텀 state 를 정의하고 노드가 부분 dict 를 반환하는 기본 규약을 보여줌.
- 구조: `START ─▶ uppercase ─▶ exclaim ─▶ END`.

### 02_llm_graph
- 01 위에 LLM 한 번 호출하는 노드를 얹은 가장 단순한 챗봇 (도구 없음).
- `MessagesState` 의 `add_messages` reducer 로 메시지가 자동 누적됨을 학습.
- 구조: `START ─▶ chat ─▶ END`.

### 03_tool_node
- prebuilt `ToolNode` 와 조건부 엣지로 ReAct 패턴 (agent ⇄ tools 사이클) 구현.
- `llm.bind_tools(...)` 로 LLM 이 tool_call 을 만들고 `ToolNode` 가 실제 실행.
- TOOLS = `get_current_time / calculate / lookup_info`.

### 04_subgraph
- 부모 그래프가 LLM 으로 의도를 분류 후 서브그래프(translator/summarizer) 로 라우팅.
- 컴파일된 subgraph 를 부모의 노드로 부착하는 패턴 + `with_structured_output` 으로 분류 강제.
- intent 가 "other" 면 서브그래프를 우회하고 바로 종료.

### 05_interrupt
- 03 의 ReAct 그래프에 `interrupt_before=["tools"]` 로 tool 실행 직전 일시정지 (HITL).
- 같은 `thread_id` 로 `invoke(None, config)` 호출하면 이어서 재개됨.
- `update_state` 로 멈춰있는 동안 메시지 직접 수정 가능.

### 06_checkpointer
- `MemorySaver` 를 부착해 `thread_id` 단위로 멀티턴 대화 히스토리 자동 저장/복원.
- 사용자가 컨텍스트를 직접 넘길 필요 없이 같은 thread 면 messages 가 누적됨.
- 운영에서는 SqliteSaver / PostgresSaver / RedisSaver 로 교체.

### 07_streaming
- `graph.stream(..., stream_mode=...)` 의 세 가지 모드 (`values`/`updates`/`messages`) 비교.
- `updates` 는 노드의 부분 업데이트, `messages` 는 LLM 토큰 단위 실시간 스트리밍.
- 운영 SSE 서버는 보통 `updates` 또는 `messages` 를 사용.

### 08_map_reduce
- `Send` API 로 런타임에 결정되는 N개 항목을 worker 로 동적 fan-out 후 reducer 로 합침.
- `Annotated[list[dict], operator.add]` 로 병렬 결과 자동 병합 (순서 비보장).
- LangGraph 가 worker 완료까지 자동으로 wait barrier 를 걸어줌.

### 09_structured_output
- `llm.with_structured_output(PydanticSchema)` 로 LLM 응답을 강제 JSON 객체화.
- `common.llm.create_llm()` 이 만든 `ChatOpenAI` 위에서 Pydantic `Sentiment` 스키마를 사용.
- 후속 노드에서 파싱 코드 없이 `state["sentiment"]["label"]` 처럼 dict 접근.

### 10_rag
- 가장 흔한 RAG 패턴 (retrieve → augment → generate) 를 인메모리 키워드 매칭으로 단순 구현.
- LangGraph 흐름 학습이 목적이라 vector DB 는 쓰지 않음 (실 운영은 OpenSearch/Pinecone 등).
- 매칭 문서가 없으면 "정보 없음" 답변을 반환하도록 컨텍스트 부족 케이스도 처리.

### 11_1_supervisor
- supervisor 노드(LLM)가 다음 worker(researcher/calculator/writer)를 결정하는 멀티에이전트 라우팅.
- conditional edge 의 mapping 으로 N-way 분기, 각 worker 는 자기만의 system prompt + tool 셋.
- worker 가 끝나면 supervisor 로 복귀 → FINISH 결정 시 종료.

### 11_2_supervisor
- 평면 supervisor 의 단점(라우팅 enum 폭발/토큰 비대화/정확도 저하)을 해결하는 **계층적** supervisor.
- top_supervisor 가 팀(data/search/writing) 을 고르고, 각 팀은 자기 worker 만 보는 컴파일된 subgraph.
- 모든 레벨이 `MessagesState` 를 공유해 팀 결과가 top 으로도 그대로 보임.

### 11_3_supervisor_diff_state
- 11_2 의 계층형 supervisor 를 확장해 부모와 팀별 subgraph 가 서로 다른 state schema 를 사용.
- 공통 키인 `messages` 만 부모/자식 간 자동 공유되고, `sql_result`, `draft`, `revision_count` 같은 팀 내부 필드는 부모로 누설되지 않음.
- top_supervisor 는 data/writing 팀만 라우팅하고, 각 팀은 자체 worker 와 내부 scratch state 를 관리.

### 11_4_supervisor_chat_subgraph
- 하나의 compiled `chat_graph` 를 `chat_after_B`, `chat_after_D`, `chat_final` 세 위치에 재사용하는 패턴.
- 부모가 `chat_command`/`chat_payload` 를 세팅하면 자식 chat subgraph 가 `summarize` 또는 `append_message` 분기로 동작.
- `ui_step_count` 는 자식 전용 state 로 유지되고, 부모에는 stage/analysis/final/messages/control 필드만 남음.

### 12_1_reflection
- LLM 이 만든 초안을 critic LLM 이 비평하고 GOOD 신호까지 다시 작성하는 self-critique 루프.
- 매 iteration 의 critique 가 다음 generate 의 system prompt 에 누적되어 점진적 개선.
- LangGraph 의 cyclic graph 강점을 가장 잘 보여주는 예제.

### 12_2_reflection
- 12_1 과 같은 reflection 루프를 `MessagesState` 위에서 재구현 + **진행상황 메시지 스트리밍**.
- critic 의 raw 비평은 사용자에게 노출하지 않고 `state["critique"]` 에만 저장 (다음 generate 컨텍스트 용).
- 사용자는 "초안 작성 중 / 검토 중 / 수정 중" 같은 progress 메시지 + 최종 draft 만 봄.

### 13_plan_and_execute
- LLM 이 task 를 단계 리스트(plan)로 분해 후 executor 가 한 step 씩 처리하며 plan 을 줄여나감.
- structured output 으로 plan 강제 + queue-like state 로 종료 조건이 결정적("plan 비었나?").
- ReAct 즉흥 판단보다 체계적이고 planner/executor 를 다른 모델로 분리해 비용 최적화 가능.

### 14_parallel_branches
- 컴파일 타임에 정해진 N개 가지(요약/태그/감정) 를 같은 입력으로 동시 실행 후 join.
- 같은 source 에서 여러 노드로 `add_edge` 만 걸면 LangGraph 가 자동 병렬 스케줄링.
- 병렬 노드가 같은 state 키를 쓸 때는 reducer (`Annotated[list, operator.add]`) 필수.

### 15_long_term_memory
- thread 를 가로지르는 영구 메모리 (`BaseStore` API) — 사용자별 선호도/사실 저장.
- 노드가 `store: BaseStore` 파라미터를 받으면 자동 주입, namespace 튜플로 사용자 격리.
- dev 서버는 `InMemoryStore` (재시작 시 휘발), Platform 은 관리형 Postgres 로 영속.

### 16_command_interrupt
- 모던 `interrupt()` 함수 + `Command(resume=...)` 으로 HITL 흐름을 한 번에 처리.
- 노드 내부에서 `value = interrupt({...})` 호출 → 페이로드가 클라이언트로 전달 → resume 값이 그대로 반환.
- 한 노드 안에 여러 interrupt 가능 (각 호출마다 한 번씩 멈춤).

### 17_configurable
- `StateGraph(config_schema=ConfigSchema)` 로 호출시점마다 model/system_prompt/style 등을 바꿀 수 있게 함.
- Studio UI 의 "Manage Assistants" 폼 자동 생성 + 노드는 `config["configurable"]` 로 값 접근.
- TypedDict 는 기본값이 없으므로 노드에서 `cfg.get("key", default)` 로 직접 처리.

### 18_custom_streaming
- `get_stream_writer()` 로 노드 내부에서 임의의 진행률/디버깅 이벤트를 직접 emit.
- 클라이언트는 `stream_mode="custom"` 또는 `["updates","custom"]` 로 수신.
- 자동 emit (07) 만으로 표현 못 하는 phase/progress 를 프론트로 흘릴 때 사용.

### 19_retry_policy
- 특정 노드에 `RetryPolicy(max_attempts, backoff_factor, retry_on=...)` 부여해 일시 오류 자동 복구.
- `retry_on` 으로 재시도할 예외 클래스를 필터링 (영속 오류는 그대로 raise).
- `add_node("name", fn, retry_policy=...)` 시그니처로 노드별 정책 부착.

### 20_history_reducer
- 그래프가 자기 실행 trace(노드 시작/종료 시각, elapsed, 변경 키)를 state.history 에 append-only 누적.
- `@with_history` 데코레이터로 모든 노드를 자동 계측, `Annotated[list[dict], operator.add]` reducer 사용.
- Checkpointer 와 결합하면 별도 로깅 인프라 없이도 trace 영속화/재구성 가능.

### 21_long_context
- 긴 대화에서 토큰 한도를 넘기지 않게 오래된 메시지를 요약하고 최근 N개만 유지.
- `RemoveMessage(id=...)` 를 반환하면 `add_messages` reducer 가 실제로 messages 에서 삭제.
- 임계값(SUMMARIZE_AFTER=8) 초과 시 요약 노드로 분기 → system prompt 에 누적 요약 합성.

### 22_evaluator_loop
- 생성 답변을 evaluator 가 `PASS/FAIL`, score, feedback 으로 평가하고 실패 시 재작성하는 루프.
- 자유형 reflection 보다 실무적인 품질 게이트: 명시 기준, 재시도 상한(MAX_ATTEMPTS=3), draft history 보존.
- 구조: `START ─▶ generate ─▶ evaluate ─┬─▶ END / └─▶ generate`.

### 23_verification_flow
- 답변 생성 후 verifier 가 필수 인용, 최소 길이, 과도한 보장 표현 같은 결정적 규칙을 검사.
- 실패 시 repair 노드가 오류 목록을 받아 수정하고 다시 verify 로 돌아가는 검증/수정 루프.
- 구조: `draft ─▶ verify ─┬─▶ END / └─▶ repair ─▶ verify`.

### 24_qa_pipeline
- RAG 를 retrieve → answer → cite_check → fallback 의 QA 파이프라인으로 확장.
- 관련 문서가 없거나 답변에 허용된 citation 이 없으면 최종 답변 대신 fallback 으로 안전하게 종료.
- `qa_status` 와 `citation_ok` 으로 프론트/테스트에서 품질 상태를 명확히 확인 가능.

### 25_approval_system
- 작업 위험도를 정책으로 분류하고 high-risk action 은 `interrupt()` 로 human approval 을 요청.
- 승인/거절/수정 후 승인 세 경로를 지원하며, 승인되지 않은 작업은 `BLOCKED` 로 종료.
- tool 실행, 외부 변경, 결제/삭제/프로덕션 작업 전에 붙이는 approval gate 패턴.
