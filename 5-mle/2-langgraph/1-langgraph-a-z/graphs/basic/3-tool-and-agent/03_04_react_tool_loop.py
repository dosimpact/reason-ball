"""
Example 03-04 — ToolNode를 사용한 ReAct loop.

쉽게 이해하기
-------------
ReAct loop는 모델이 다음 행동을 고르고, 도구 결과를 읽으며 답을 완성하는 반복이다.
예: 계산이 필요하면 도구를 호출하고 그 결과로 답한다.
agent → tools → agent를 반복하며 도구 요청이 없으면 종료한다.

새 개념
-------
- agent가 tool call을 만들면 tools로, 아니면 END로 routing
- `tools → agent` cycle에서 tool 결과를 읽고 최종 답변 생성
- 앞에서 배운 routing, cycle, tool-call, ToolNode의 결합
- 계산, 조회, 웹 검색 등 도구 종류가 달라도 graph 구조는 동일함

그래프 구조
-----------
모델이 고른 도구를 실행하고 결과를 다시 모델에 전달하는 과정을 반복해 최종 답변을 만든다.

START ─▶ agent ⇄ tools
            │
            └─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "12 * 7을 계산해줘."
    }
  ]
}
```
관찰할 결과: agent → tools → agent 흐름, 계산 도구 결과와 최종 응답을 확인합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
"""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm
from common.tools import TOOLS


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


def build_graph():
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
