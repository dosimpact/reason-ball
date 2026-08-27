"""
Example 32 — subgraph의 input/output/internal state schema 분리.

선행 예제
---------
- 31: 컴파일된 subgraph를 부모 node로 등록하는 방법
- 04: graph의 input/output/internal state schema

새 개념
-------
- 앞서 배운 schema 분리를 subgraph 경계에 적용
- `state_schema`: subgraph 내부에서 사용할 전체 state
- `input_schema`: subgraph가 받는 public input key
- `output_schema`: subgraph가 부모에 반환하는 public output key
- `cleaned` 같은 자식 전용 scratch key는 부모 state로 누출되지 않는다.

복습 개념
-------
- 부모와 자식 사이에 이름이 같은 public key를 통해 데이터를 전달한다.
- subgraph는 부모 graph에서 하나의 Runnable node다.

그래프 구조
-----------
parent: START ─▶ summarize_text(subgraph) ─▶ format_result ─▶ END
child : START ─▶ clean ─▶ summarize ─▶ END
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class ParentState(TypedDict, total=False):
    text: str
    summary: str
    result: str


class ChildInput(TypedDict):
    text: str


class ChildOutput(TypedDict):
    summary: str


class ChildState(TypedDict, total=False):
    text: str
    cleaned: str
    summary: str


def clean(state: ChildState) -> dict:
    return {"cleaned": " ".join(state["text"].strip().split())}


def summarize(state: ChildState) -> dict:
    words = state["cleaned"].split()
    short = " ".join(words[:8])
    return {"summary": short + ("..." if len(words) > 8 else "")}


def build_summary_subgraph():
    builder = StateGraph(
        state_schema=ChildState,
        input_schema=ChildInput,
        output_schema=ChildOutput,
    )
    builder.add_node("clean", clean)
    builder.add_node("summarize", summarize)
    builder.add_edge(START, "clean")
    builder.add_edge("clean", "summarize")
    builder.add_edge("summarize", END)
    return builder.compile()


def format_result(state: ParentState) -> dict:
    return {"result": f"SUMMARY: {state['summary']}"}


def build_graph():
    builder = StateGraph(ParentState)
    builder.add_node("summarize_text", build_summary_subgraph())
    builder.add_node("format_result", format_result)
    builder.add_edge(START, "summarize_text")
    builder.add_edge("summarize_text", "format_result")
    builder.add_edge("format_result", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke(
        {"text": "LangGraph subgraphs can keep private scratch state from the parent"}
    )
    print(out)
    assert "cleaned" not in out
