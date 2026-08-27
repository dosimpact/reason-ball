"""
Example 15 — ToolNode를 사용한 ReAct loop.

선행 예제
---------
- 05_conditional_routing
- 06_cycles_and_recursion
- 13_tool_calls
- 14_tool_node

새 개념
-------
- agent가 tool call을 만들면 tools로, 아니면 END로 routing
- `tools → agent` cycle에서 tool 결과를 읽고 최종 답변 생성
- 앞에서 배운 routing, cycle, tool-call, ToolNode의 결합
- 계산, 조회, 웹 검색 등 도구 종류가 달라도 graph 구조는 동일함

복습 개념
---------
- `MessagesState`, `bind_tools`, `ToolMessage`

그래프 구조
-----------
START ─▶ agent ⇄ tools
            │
            └─▶ END
"""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm
from common.tools import TOOLS


def build_graph():
    model_with_tools = create_llm().bind_tools(TOOLS)

    def agent(state: MessagesState) -> dict:
        response = model_with_tools.invoke(
            [
                SystemMessage(
                    content=(
                        "Use the available tools when needed. "
                        "After receiving tool results, answer the user concisely."
                    )
                )
            ]
            + state["messages"]
        )
        return {"messages": [response]}

    def route_after_agent(state: MessagesState) -> Literal["tools", "__end__"]:
        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return "__end__"

    builder = StateGraph(MessagesState)
    builder.add_node("agent", agent)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent",
        route_after_agent,
        {"tools": "tools", "__end__": END},
    )
    builder.add_edge("tools", "agent")
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke(
        {"messages": [HumanMessage(content="12 * 7을 계산해줘.")]}
    )
    print(output["messages"][-1].content)
