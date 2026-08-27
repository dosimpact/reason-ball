"""
Example 31 — 가장 단순한 subgraph 조합.

선행 예제
---------
- 01: StateGraph, START/END, node, edge
- 04: 하나의 graph 안에서 state schema를 공유하는 방법

새 개념
-------
- 컴파일된 graph도 Runnable이므로 다른 graph의 node로 등록할 수 있다.
- 부모와 자식이 같은 state schema를 쓰면 공유 key가 자연스럽게 전달된다.

복습 개념
-------
- 노드는 state의 변경분 dict를 반환한다.
- 부모 graph의 입장에서 subgraph는 하나의 node처럼 보인다.

그래프 구조
-----------
parent: START ─▶ prepare ─▶ text_pipeline(subgraph) ─▶ finalize ─▶ END
child : START ─▶ normalize ─▶ decorate ─▶ END
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    text: str
    normalized: str
    decorated: str
    result: str


def normalize(state: State) -> dict:
    return {"normalized": " ".join(state["text"].strip().split()).lower()}


def decorate(state: State) -> dict:
    return {"decorated": f"<{state['normalized']}>"}


def build_text_subgraph():
    builder = StateGraph(State)
    builder.add_node("normalize", normalize)
    builder.add_node("decorate", decorate)
    builder.add_edge(START, "normalize")
    builder.add_edge("normalize", "decorate")
    builder.add_edge("decorate", END)
    return builder.compile()


def prepare(state: State) -> dict:
    return {"text": state.get("text", "")}


def finalize(state: State) -> dict:
    return {"result": f"subgraph result: {state['decorated']}"}


def build_graph():
    text_pipeline = build_text_subgraph()

    builder = StateGraph(State)
    builder.add_node("prepare", prepare)
    builder.add_node("text_pipeline", text_pipeline)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "prepare")
    builder.add_edge("prepare", "text_pipeline")
    builder.add_edge("text_pipeline", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"text": "  Hello    LangGraph  "}))
