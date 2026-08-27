"""
Example 13 — bind_tools와 AIMessage.tool_calls.

선행 예제
---------
- 09_messages_state
- 12_tool_schema

새 개념
-------
- `llm.bind_tools()`는 tool schema를 모델에 전달
- 모델은 tool을 실행하지 않고 `AIMessage.tool_calls`에 실행 요청을 작성
- 요청의 name, args, id를 직접 확인

복습 개념
---------
- `MessagesState`, `@tool`, LLM message 호출

그래프 구조
-----------
START ─▶ request_tool ─▶ END

이 예제는 의도적으로 tool을 실행하지 않습니다.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


@tool
def multiply(a: int, b: int) -> int:
    """두 정수의 곱을 반환합니다."""
    return a * b


def build_graph():
    model_with_tools = create_llm().bind_tools([multiply])

    def request_tool(state: MessagesState) -> dict:
        response = model_with_tools.invoke(
            [
                SystemMessage(
                    content="Use the multiply tool whenever multiplication is requested."
                )
            ]
            + state["messages"]
        )
        return {"messages": [response]}

    builder = StateGraph(MessagesState)
    builder.add_node("request_tool", request_tool)
    builder.add_edge(START, "request_tool")
    builder.add_edge("request_tool", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke(
        {"messages": [HumanMessage(content="12와 7을 곱해줘.")]}
    )
    ai_message = output["messages"][-1]
    print("content:", ai_message.content)
    print("tool_calls:", ai_message.tool_calls)
