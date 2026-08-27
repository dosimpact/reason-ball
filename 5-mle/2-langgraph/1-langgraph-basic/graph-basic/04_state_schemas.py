"""
Example 04 — 입력·내부·출력 state schema 분리.

선행 예제
---------
- 02_state_updates

새 개념
-------
- `state_schema`: 그래프 내부에서 사용하는 전체 state
- `input_schema`: 호출자가 입력할 수 있는 필드
- `output_schema`: 호출자에게 반환할 필드
- 내부 scratch 필드를 외부 contract에서 숨기는 방법

복습 개념
---------
- 부분 update, 직선 graph

그래프 구조
-----------
START ─▶ prepare ─▶ format_result ─▶ END
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class InputState(TypedDict):
    text: str


class OutputState(TypedDict):
    result: str


class State(InputState, OutputState, total=False):
    normalized: str


def prepare(state: State) -> dict:
    return {"normalized": state["text"].strip().title()}


def format_result(state: State) -> dict:
    return {"result": f"Hello, {state['normalized']}!"}


def build_graph():
    builder = StateGraph(
        State,
        input_schema=InputState,
        output_schema=OutputState,
    )
    builder.add_node("prepare", prepare)
    builder.add_node("format_result", format_result)
    builder.add_edge(START, "prepare")
    builder.add_edge("prepare", "format_result")
    builder.add_edge("format_result", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"text": "  langgraph learner  "}))
