"""
Example 03 — Tool node 추가 (ReAct 에이전트).

02 에 prebuilt `ToolNode` 와 조건부 엣지를 추가해 ReAct 패턴을 구현합니다.

학습 포인트
-----------
- `llm.bind_tools(TOOLS)` 로 LLM 이 tool_call 을 생성할 수 있게 함
- `ToolNode(TOOLS)` 가 tool_call 을 실제로 실행하고 `ToolMessage` 를 반환
- `add_conditional_edges` 로 "agent → tools" / "agent → END" 분기
- "tools → agent" 엣지로 사이클 구성

그래프 구조
-----------
START ─▶ agent ⇄ tools
            │
            ▼
           END

테스트용 메시지 예시 (LangGraph Studio / invoke 입력)
----------------------------------------------------
바인딩된 TOOLS = [get_current_time, calculate, lookup_info]

▶ get_current_time
   - "지금 몇 시야?"
   - "What time is it now?"

▶ calculate
   - "123 * 456 계산해줘"
   - "(15 + 27) / 6 은 얼마야?"

▶ lookup_info
   - "langgraph 가 뭐야?"
   - "bedrock 에 대해 알려줘"
   - "fastapi 설명해줘"

▶ tool 사용 안 하는 일반 대화 (agent → END 바로 종료 확인용)
   - "안녕!"
   - "너 누구야?"

▶ 여러 tool 을 연속 호출 (tools ⇄ agent 사이클 확인용)
   - "지금 몇 시인지 알려주고, 12 * 7 도 계산해줘"
   - "langgraph 설명해주고 fastapi 도 같이 알려줘"
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
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    out = graph.invoke({"messages": [HumanMessage(content="지금 몇 시야?")]})
    print(out["messages"][-1].content)
