"""
Example 14 — ToolNode로 tool call 실행하기.

선행 예제
---------
- 09_messages_state
- 13_tool_calls

새 개념
-------
- `ToolNode`는 마지막 `AIMessage.tool_calls`를 읽어 tool을 실행
- 실행 결과는 요청 id와 연결된 `ToolMessage`로 추가됨
- tool 요청 생성과 tool 실행은 서로 다른 단계

복습 개념
---------
- `MessagesState`, message reducer, tool-call 구조

그래프 구조
-----------
START ─▶ prepare_call ─▶ tools ─▶ END

LLM 없이 tool call을 직접 만들어 ToolNode 동작만 분리해서 관찰합니다.
"""

from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import AIMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode


@tool
def multiply(a: int, b: int) -> int:
    """두 정수의 곱을 반환합니다."""
    return a * b


class State(MessagesState, total=False):
    a: int
    b: int


def prepare_call(state: State) -> dict:
    request = AIMessage(
        content="",
        tool_calls=[
            {
                "name": "multiply",
                "args": {"a": state["a"], "b": state["b"]},
                "id": "multiply-demo-call",
                "type": "tool_call",
            }
        ],
    )
    return {"messages": [request]}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("prepare_call", prepare_call)
    builder.add_node("tools", ToolNode([multiply]))
    builder.add_edge(START, "prepare_call")
    builder.add_edge("prepare_call", "tools")
    builder.add_edge("tools", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"messages": [], "a": 12, "b": 7})
    for message in output["messages"]:
        print(type(message).__name__, message.content)
