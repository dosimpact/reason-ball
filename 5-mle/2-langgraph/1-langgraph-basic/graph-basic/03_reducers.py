"""
Example 03 — reducer로 state 값을 누적하기.

선행 예제
---------
- 02_state_updates

새 개념
-------
- `Annotated[value_type, reducer]`로 key별 병합 규칙 선언
- 여러 노드가 반환한 list를 `operator.add`로 누적
- reducer가 없는 key의 overwrite와 reducer key의 merge 비교

복습 개념
---------
- 부분 state update

그래프 구조
-----------
START ─▶ clean ─▶ enrich ─▶ END
"""

import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    text: str
    status: str
    steps: Annotated[list[str], operator.add]


def clean(state: State) -> dict:
    return {
        "text": state["text"].strip(),
        "status": "cleaned",
        "steps": ["clean"],
    }


def enrich(state: State) -> dict:
    return {
        "text": f"{state['text']}!",
        "status": "enriched",
        "steps": ["enrich"],
    }


def build_graph():
    builder = StateGraph(State)
    builder.add_node("clean", clean)
    builder.add_node("enrich", enrich)
    builder.add_edge(START, "clean")
    builder.add_edge("clean", "enrich")
    builder.add_edge("enrich", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"text": "  hello  ", "steps": []}))
