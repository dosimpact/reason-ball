"""
Example 07 — Command로 state update와 routing을 함께 반환하기.

선행 예제
---------
- 05_conditional_routing

새 개념
-------
- `Command(update=..., goto=...)`
- node가 state 변경과 다음 node 결정을 한 번에 수행
- `Command[Literal[...]]`로 가능한 목적지를 타입에 표시

복습 개념
---------
- 조건 분기, 부분 state update

그래프 구조
-----------
              ┌─▶ positive ─┐
START ─▶ route               ├─▶ END
              └─▶ negative ─┘
"""

from __future__ import annotations

from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Command


class State(TypedDict, total=False):
    score: int
    route: str
    message: str


def route(state: State) -> Command[Literal["positive", "negative"]]:
    destination = "positive" if state["score"] >= 0 else "negative"
    return Command(update={"route": destination}, goto=destination)


def positive(state: State) -> dict:
    return {"message": f"score {state['score']} is non-negative"}


def negative(state: State) -> dict:
    return {"message": f"score {state['score']} is negative"}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("route", route)
    builder.add_node("positive", positive)
    builder.add_node("negative", negative)
    builder.add_edge(START, "route")
    builder.add_edge("positive", END)
    builder.add_edge("negative", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"score": 3}))
    print(graph.invoke({"score": -1}))
