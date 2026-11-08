"""
Example 03-01 — tool 정의와 입력 schema.

쉽게 이해하기
-------------
Tool은 모델이 요청할 수 있도록 이름·설명·입력 형식을 붙인 함수다.
예: 계산 함수를 @tool로 감싸면 어떤 인자를 받는지 설명할 수 있다.
여기서는 모델 없이 tool.invoke()를 호출해 도구 자체의 동작을 확인한다.

새 개념
-------
- `@tool`로 일반 함수를 모델이 이해할 수 있는 tool로 변환
- 함수 이름, docstring, type hint가 tool schema를 구성
- tool은 LLM 없이도 `.invoke()`로 직접 실행 가능

그래프 구조
-----------
두 정수를 곱하는 도구를 직접 실행하고, 계산 결과와 도구의 입력 스키마를 반환한다.

START ─▶ run_tool ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "a": 12,
  "b": 7
}
```
관찰할 결과: result=84이며 tool_schema에 multiply의 a/b 정수 입력 schema가 포함됩니다.
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
