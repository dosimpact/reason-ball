"""
Example 06 — Checkpointer 로 멀티턴 대화.

동일한 그래프를 여러 번 호출할 때 `thread_id` 별로 상태(=메시지 히스토리)를
자동 저장/복원하는 패턴.

학습 포인트
-----------
- `compile(checkpointer=MemorySaver())` — 인메모리 체크포인터
- 호출 시 `config={"configurable": {"thread_id": "<id>"}}` 로 세션 식별
- 같은 thread_id 면 이전 메시지가 자동으로 state["messages"] 에 누적되어
  사용자는 "이전 대화 컨텍스트" 를 별도로 넘기지 않아도 된다.
- 운영에서는 `SqliteSaver`, `PostgresSaver`, `RedisSaver` 등으로 교체.

그래프 구조 (03 과 동일, 단 checkpointer 만 추가)
-----------
START ─▶ agent ⇄ tools ─▶ END

테스트 메시지 예시 (멀티턴 — 같은 thread_id 로 연속 호출)
-------------------------------------------------------
Studio: 같은 conversation 안에서 순서대로 보내면 됩니다.
CLI:    config={"configurable": {"thread_id": "user-42"}} 고정.

▶ 시나리오 1 — 이름 기억하기
   1) "내 이름은 도경이야."
   2) "내 이름이 뭐였지?"           ← "도경" 이라고 답해야 정상

▶ 시나리오 2 — 이전 tool 결과 참조
   1) "지금 몇 시야?"
   2) "방금 알려준 시간에서 3시간 뒤는?"

▶ 시나리오 3 — 컨텍스트 누적
   1) "내가 좋아하는 색은 파란색이야."
   2) "내 취미는 등산이야."
   3) "내가 알려준 정보 두 가지를 요약해줘."

※ thread_id 를 바꾸면 컨텍스트가 격리되어 기억하지 못함 (정상 동작)
"""

from __future__ import annotations

from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm
from common.tools import TOOLS
from node.llm_node import make_call_model
from node.routing import should_continue
from node.tool_node import make_tool_node


def build_graph():
    llm = create_llm()
    builder = StateGraph(MessagesState)
    builder.add_node("agent", make_call_model(llm, tools=TOOLS))
    builder.add_node("tools", make_tool_node(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    # checkpointer 는:
    #  - `langgraph dev` / LangGraph API 환경: 플랫폼이 자동 주입 (커스텀 지정 시 에러)
    #  - 단독 실행: __main__ 에서 MemorySaver 부착
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage
    from langgraph.checkpoint.memory import MemorySaver

    from common.llm import create_llm
    from common.tools import TOOLS as _T
    from node.llm_node import make_call_model
    from node.routing import should_continue
    from node.tool_node import make_tool_node

    b = StateGraph(MessagesState)
    b.add_node("agent", make_call_model(create_llm(), tools=_T))
    b.add_node("tools", make_tool_node(_T))
    b.add_edge(START, "agent")
    b.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    b.add_edge("tools", "agent")
    standalone = b.compile(checkpointer=MemorySaver())

    cfg = {"configurable": {"thread_id": "user-42"}}
    # 1턴
    standalone.invoke(
        {"messages": [HumanMessage(content="내 이름은 도경이야.")]}, config=cfg
    )
    # 2턴 — 이전 컨텍스트가 자동 복원되므로 "내 이름" 을 기억함
    out = standalone.invoke(
        {"messages": [HumanMessage(content="내 이름이 뭐였지?")]}, config=cfg
    )
    print(out["messages"][-1].content)
