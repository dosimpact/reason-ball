# Langgraph SDK Playbook

## 1. 채팅 및 스트리밍

### 1.1 기본 채팅과 스트리밍 UI 구성

목적 : LangGraph graph를 OpenAI-backed chat으로 연결하고, thread 기반 대화 유지와 실시간 streaming UI를 구성한다.

상세 로직

1. LangGraph 상태 및 그래프 로직
  - `MessagesState`를 사용하면 `messages` 누적 상태를 기본으로 다룰 수 있다.
  - 단일 노드 `call_model`에서 `SystemMessage`와 기존 `state["messages"]`를 LLM에 전달한다.
  - 노드는 `{"messages": [response]}`를 반환해서 assistant 응답을 thread message state에 append한다.
  - graph 구조는 `START -> chat -> END`처럼 단순하게 둔다.
  - 같은 `thread_id`로 실행하면 LangGraph checkpoint가 이전 messages를 유지한다.
  - `MessagesState` 대신 `TypedDict` state를 정의해 `prompt`, `answer`, `final`, `progress`를 관리한다.
  - 여러 노드로 `prepare_prompt -> call_model -> finalize` 흐름을 만든다.
  - 각 노드는 state update를 반환하고, `progress` 배열에 진행 기록을 직접 남긴다.

2. Frontend 및 SDK 처리
  - 실행 전 `client.threads.create(...)`로 thread를 만들거나 기존 thread를 재사용한다.
  - `client.runs.stream(threadId, graphId, { input, streamMode })`로 graph를 실행한다.
  - 같은 `thread_id`로 follow-up 질문을 실행해야 누적 messages를 기반으로 답변한다.
  - chat은 `messages`를 렌더링하고, streaming UI는 stream chunk와 final state를 함께 반영한다.

3. Custom stream event
  - `get_stream_writer()(event)`를 호출하면 graph 내부 진행 상황을 custom stream event로 즉시 보낼 수 있다.
  - event는 `{ node, phase, progress, detail }`처럼 UI가 바로 그릴 수 있는 형태로 만든다.
  - streaming 중에는 custom event로 progress를 표시하고, 완료 후에는 final state의 `progress`로 전체 기록을 확인한다.

### 1.2 특정 노드 및 진행 상황 (step)을 표기

목적 : LangGraph 실행 과정을 사용자에게 노드/step 단위로 보여주고, 어떤 단계가 진행 중인지 실시간으로 표시한다.

상세 로직

1. LangGraph 상태 정의
  - `steps`, `node_updates` 같은 진행 상태 필드를 state에 직접 정의한다.
  - LangGraph는 `node_updates`를 자동 기록하지 않는다.
  - 각 노드 함수는 반환값에 `steps: [..., "node_name"]`, `node_updates: [...update]`를 직접 넣는다.
  - graph node name과 frontend `nodeOrder`의 name은 반드시 동일하게 맞춘다.
  - `streamMode: "updates"`를 쓰면 노드별 반환값이 `{ node_name: payload }` 형태로 스트리밍된다.

2. Frontend 표시
  - 프론트는 `payload[nodeName]` 존재 여부로 해당 노드를 `done` 처리한다.
  - 다음 `pending` 노드를 `running`으로 표시한다.
  - 실행 완료 후 `client.threads.getState(threadId)`로 최종 state를 다시 동기화한다.
  - 노드명이 불일치하면 스트림은 와도 타임라인 UI가 갱신되지 않는다.

## 2. Tool Calling

### 2.1 ReAct 스타일 tool calling graph 구성

목적 : LangGraph graph에서 LLM의 tool call 요청을 `ToolNode`로 실행하고, tool 결과를 다시 agent에 전달해 최종 응답까지 이어지는 ReAct 루프를 구성한다.

상세 로직

1. LangGraph 상태 및 그래프 로직
  - `MessagesState`를 사용해 user message, AI message, tool message를 같은 `messages` state에 누적한다.
  - tool 함수는 `@tool("calculator")`, `@tool("lookup_langgraph_term")`처럼 명시적인 tool name을 붙이고 `TOOLS` 배열로 묶는다.
  - agent 노드에서는 `create_llm().bind_tools(TOOLS)`로 LLM에 사용 가능한 tool schema를 전달한다.
  - agent 노드는 `SystemMessage`와 기존 `state["messages"]`를 함께 invoke하고 `{"messages": [response]}`만 반환한다.
  - `route_after_agent`는 마지막 message의 `tool_calls` 존재 여부를 확인해 `"tools"` 또는 `"__end__"`로 분기한다.
  - graph는 `START -> agent`, `agent -> tools | END`, `tools -> agent` 구조로 만들어 tool 실행 후 반드시 agent가 최종 답변을 생성하게 한다.
  - `ToolNode(TOOLS)`의 node name은 conditional edge의 `"tools"` target과 일치해야 한다.

2. Frontend 및 SDK 처리
  - frontend는 같은 thread에서 run을 실행해 tool call 전후의 `messages` 흐름을 이어서 표시한다.
  - `streamMode: "updates"`를 사용할 때는 `agent` update와 `tools` update를 분리해 tool 요청, tool 결과, 최종 assistant 응답을 단계별로 렌더링한다.
  - UI에 표시할 node 이름은 graph의 `"agent"`, `"tools"`와 맞춰야 stream update를 안정적으로 매핑할 수 있다.
  - tool 결과 이후 final answer가 비어 있으면 `tools -> agent` edge 또는 system prompt의 최종 답변 지시를 확인한다.

## 3. Human-in-the-loop

### 3.1 interrupt 기반 승인 흐름 구성

목적 : 고위험 action을 graph 중간에서 일시정지하고, 사용자 승인/거절/수정 입력을 `Command(resume=...)`로 받아 실행 여부를 결정한다.

상세 로직

1. LangGraph 상태 및 그래프 로직
  - `TypedDict` state에 `action`, `proposed_action`, `risk`, `risk_summary`, `approved`, `decision`, `edited_action`, `execution_result`, `final`, `approval_payload`처럼 승인 전후에 필요한 필드를 명시한다.
  - `prepare_action`에서 위험어를 검사해 `risk`와 기본 `approved` 값을 만들고, `summarize_risk`에서 LLM은 위험 요약만 생성하게 한다.
  - `route_after_summary`는 `approved`가 참이면 `"execute"`, 아니면 `"request_approval"`로 보내 자동 승인과 수동 승인을 분리한다.
  - `request_approval` 노드에서 `interrupt(payload)`를 호출하면 graph 실행이 중단되고 payload가 client에 전달된다.
  - resume 값은 문자열 `"approve"` 또는 dict `{ "action": "edit", "action_text": ... }`처럼 UI contract에 맞춰 처리한다.
  - 수정 승인일 때는 `proposed_action`을 edited text로 덮어쓴 뒤 `approved: True`, `decision: "edited_approval"`을 반환한다.
  - 거절 또는 알 수 없는 resume 값은 `approved: False`, `decision: "rejected"`로 남겨 `execute` 노드가 `BLOCKED` 결과를 만들게 한다.
  - interrupt resume은 checkpoint가 필요하므로 로컬 실행에서는 `builder.compile(checkpointer=MemorySaver())`와 고정 `thread_id`를 사용한다.

2. Frontend 및 SDK 처리
  - 첫 실행은 일반 input으로 run을 시작하고, interrupt payload의 `kind`, `question`, `action`, `risk`, `risk_summary`, `options`를 승인 UI에 매핑한다.
  - 사용자가 승인/거절/수정을 선택하면 같은 `thread_id`에서 `Command(resume=...)`에 해당하는 resume payload를 보내야 중단된 노드 다음으로 이어진다.
  - 승인 UI의 action 값은 backend의 `"approve"`, `"reject"`, `"edit"` 분기와 정확히 맞춘다.
  - 다른 thread로 resume하거나 checkpoint 없이 compile하면 interrupt 위치를 찾지 못해 승인 이후 실행이 이어지지 않는다.
