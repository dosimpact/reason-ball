"""
Example 02 — 노드의 부분 state update.

선행 예제
---------
- 01_simple_graph

새 개념
-------
- 노드는 전체 state가 아니라 변경할 key만 반환할 수 있음
- reducer가 없는 key는 새 값으로 덮어씀
- 다음 노드는 앞 노드의 update가 합쳐진 state를 받음

복습 개념
---------
- `StateGraph`, 직선 edge, `invoke()`

그래프 구조
-----------
START ─▶ normalize ─▶ measure ─▶ END
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    text: str
    normalized: str
    length: int


def normalize(state: State) -> dict:
    """normalized만 갱신하고 입력 text는 그대로 둡니다."""
    return {"normalized": state["text"].strip().lower()}


def measure(state: State) -> dict:
    """앞 노드가 추가한 normalized를 읽어 length만 갱신합니다."""
    return {"length": len(state["normalized"])}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("normalize", normalize)
    builder.add_node("measure", measure)
    builder.add_edge(START, "normalize")
    builder.add_edge("normalize", "measure")
    builder.add_edge("measure", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"text": "  Hello LangGraph  "}))
