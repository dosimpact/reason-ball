"""
Example 12 — tool 정의와 입력 schema.

선행 예제
---------
- 02_state_updates

새 개념
-------
- `@tool`로 일반 함수를 모델이 이해할 수 있는 tool로 변환
- 함수 이름, docstring, type hint가 tool schema를 구성
- tool은 LLM 없이도 `.invoke()`로 직접 실행 가능

복습 개념
---------
- 일반 custom state와 단일 node

그래프 구조
-----------
START ─▶ run_tool ─▶ END
"""

from __future__ import annotations

from typing import TypedDict

from langchain_core.tools import tool
from langgraph.graph import END, START, StateGraph


@tool
def multiply(a: int, b: int) -> int:
    """두 정수의 곱을 반환합니다.

    Args:
        a: 첫 번째 정수.
        b: 두 번째 정수.
    """
    return a * b


class State(TypedDict, total=False):
    a: int
    b: int
    result: int
    tool_schema: dict


def run_tool(state: State) -> dict:
    return {
        "result": multiply.invoke({"a": state["a"], "b": state["b"]}),
        "tool_schema": multiply.args_schema.model_json_schema(),
    }


def build_graph():
    builder = StateGraph(State)
    builder.add_node("run_tool", run_tool)
    builder.add_edge(START, "run_tool")
    builder.add_edge("run_tool", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"a": 12, "b": 7})
    print("schema:", output["tool_schema"])
    print("result:", output["result"])
