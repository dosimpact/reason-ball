"""
Example 05 — Interrupt (Human-in-the-loop).

03 의 ReAct 그래프에 "tool 실행 직전 일시정지" 기능을 추가해
사람이 승인/수정한 뒤에만 tool 호출이 진행되도록 합니다.

학습 포인트
-----------
- `compile(checkpointer=..., interrupt_before=["tools"])` 로 특정 노드 진입 직전에 멈춤
- 멈춘 그래프는 `graph.get_state(config)` 로 상태 확인 가능
- 동일한 `thread_id` 로 `graph.invoke(None, config)` 호출하면 이어서 재개
- 멈춘 동안 `graph.update_state(config, {...})` 로 메시지를 직접 수정할 수도 있음

그래프 구조 (논리적으로는 03 과 동일, 단 'tools' 노드 진입 직전 일시정지)
-----------
START ─▶ agent ⇄ tools (⛔ before)
            │
            ▼
           END

테스트 메시지 예시 (state = MessagesState, **반드시 thread_id 필요**)
-------------------------------------------------------------------
tool 호출이 발생해야 interrupt 가 걸립니다. tool 안 쓰는 인사말로는
멈추지 않고 그대로 END 로 갑니다.

▶ tool 호출 → interrupt 발동
   - "지금 몇 시야?"            (get_current_time)
   - "2 + 2 를 계산해줘"        (calculate)
   - "langgraph 가 뭐야?"       (lookup_info)

▶ interrupt 안 걸리는 케이스 (확인용)
   - "안녕!"
   - "넌 누구야?"

재개 방법 (Studio):
   1) 첫 invoke 후 graph 가 'tools' 직전에서 멈춤
   2) 같은 thread 에서 "Continue" 클릭 → 이어서 tool 실행

참고
- 05_2 예제는 노드 내부에서 value = interrupt({...}) 호출 → state 에 __interrupt__ 라는 특수 필드가 추가
됨 (페이로드 운반용). 이건 진짜로 interrupt 가 state 에 뭘 넣는 케이스.

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
    agent_node = make_call_model(llm, tools=TOOLS)
    tool_node = make_tool_node(TOOLS)

    builder = StateGraph(MessagesState)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", tool_node)

    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")

    # interrupt_before 만 지정. checkpointer 는:
    #  - `langgraph dev` / LangGraph API 환경: 플랫폼이 자동 주입
    #  - 단독 실행: __main__ 에서 직접 MemorySaver 를 주입
    return builder.compile(interrupt_before=["tools"])


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage
    from langgraph.checkpoint.memory import MemorySaver

    from common.llm import create_llm
    from common.tools import TOOLS as _T
    from node.llm_node import make_call_model
    from node.routing import should_continue
    from node.tool_node import make_tool_node

    # 단독 실행: in-memory checkpointer + interrupt_before 를 함께 컴파일
    b = StateGraph(MessagesState)
    b.add_node("agent", make_call_model(create_llm(), tools=_T))
    b.add_node("tools", make_tool_node(_T))
    b.add_edge(START, "agent")
    b.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    b.add_edge("tools", "agent")
    standalone = b.compile(checkpointer=MemorySaver(), interrupt_before=["tools"])

    cfg = {"configurable": {"thread_id": "demo-interrupt-1"}}
    standalone.invoke(
        {"messages": [HumanMessage(content="2 + 2 를 계산해줘")]}, config=cfg
    )
    state = standalone.get_state(cfg)
    print("interrupted at:", state.next)  # ('tools',)
    out = standalone.invoke(None, config=cfg)
    print(out["messages"][-1].content)
