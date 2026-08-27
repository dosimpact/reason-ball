"""
Example 06 — cycle과 명시적인 종료 조건.

선행 예제
---------
- 05_conditional_routing

새 개념
-------
- node에서 자기 자신으로 돌아가는 cycle
- state 기반 종료 조건
- `recursion_limit`으로 잘못된 무한 반복을 방어하는 방법

복습 개념
---------
- 조건부 edge, reducer

그래프 구조
-----------
START ─▶ countdown ─┬─▶ countdown
                    └─▶ finish ─▶ END
"""

import operator
from typing import Annotated, Literal, TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    remaining: int
    visited: Annotated[list[int], operator.add]
    result: str


def countdown(state: State) -> dict:
    current = state["remaining"]
    return {"remaining": current - 1, "visited": [current]}


def continue_or_finish(state: State) -> Literal["countdown", "finish"]:
    return "countdown" if state["remaining"] > 0 else "finish"


def finish(state: State) -> dict:
    return {"result": f"visited={state.get('visited', [])}"}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("countdown", countdown)
    builder.add_node("finish", finish)
    builder.add_edge(START, "countdown")
    builder.add_conditional_edges(
        "countdown",
        continue_or_finish,
        {"countdown": "countdown", "finish": "finish"},
    )
    builder.add_edge("finish", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"remaining": 3, "visited": []}, config={"recursion_limit": 10}))
