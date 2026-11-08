"""
Example 03-03 — ToolNode로 tool call 실행하기.

쉽게 이해하기
-------------
ToolNode는 모델의 도구 실행 요청을 받아 실제 함수를 호출하는 노드다.
예: 계산 요청을 받아 결과를 ToolMessage로 돌려준다.
이 예제는 요청을 직접 만들어 요청 ID와 결과가 연결되는 모습을 보여준다.

새 개념
-------
- `ToolNode`는 마지막 `AIMessage.tool_calls`를 읽어 tool을 실행
- 실행 결과는 요청 id와 연결된 `ToolMessage`로 추가됨
- tool 요청 생성과 tool 실행은 서로 다른 단계

그래프 구조
-----------
두 정수의 곱셈 호출 요청을 코드로 만들고, ToolNode로 실행해 결과를 ToolMessage에 추가한다.

START ─▶ prepare_call ─▶ tools ─▶ END

LLM 없이 tool call을 직접 만들어 ToolNode 동작만 분리해서 관찰합니다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [],
  "a": 12,
  "b": 7
}
```
관찰할 결과: AIMessage 도구 요청 뒤에 같은 tool_call_id의 ToolMessage가 추가되고 결과가 84입니다.
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
