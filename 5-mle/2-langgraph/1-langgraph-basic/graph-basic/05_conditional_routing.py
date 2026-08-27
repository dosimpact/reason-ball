"""
Example 05 — 조건부 edge로 경로 선택하기.

선행 예제
---------
- 01_simple_graph

새 개념
-------
- routing 함수는 state를 읽고 다음 경로 이름을 반환
- `add_conditional_edges()`의 반환값과 node mapping
- `Literal`로 가능한 경로를 명시

복습 개념
---------
- node, edge, 부분 state update

그래프 구조
-----------
                 ┌─▶ handle_even ─┐
START ─▶ classify                 ├─▶ END
                 └─▶ handle_odd ──┘
"""

from __future__ import annotations

from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    number: int
    category: str
    message: str


def classify(state: State) -> dict:
    return {"category": "even" if state["number"] % 2 == 0 else "odd"}


def route_by_category(state: State) -> Literal["handle_even", "handle_odd"]:
    return "handle_even" if state["category"] == "even" else "handle_odd"


def handle_even(state: State) -> dict:
    return {"message": f"{state['number']} is even"}


def handle_odd(state: State) -> dict:
    return {"message": f"{state['number']} is odd"}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("classify", classify)
    builder.add_node("handle_even", handle_even)
    builder.add_node("handle_odd", handle_odd)
    builder.add_edge(START, "classify")
    builder.add_conditional_edges(
        "classify",
        route_by_category,
        {"handle_even": "handle_even", "handle_odd": "handle_odd"},
    )
    builder.add_edge("handle_even", END)
    builder.add_edge("handle_odd", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"number": 7}))
    print(graph.invoke({"number": 12}))
