"""
Example 05-04 — subgraph의 input/output/internal state schema 분리.

쉽게 이해하기
-------------
Subgraph의 schema는 작은 그래프가 받을 값과 돌려줄 값을 정하는 경계다.
예: text를 받아 내부 cleaned를 만든 뒤 부모에게는 summary만 돌려준다.
자식이 계산에 쓰는 중간값을 부모에게 모두 넘길 필요가 없어진다.

새 개념
-------
- 앞서 배운 schema 분리를 subgraph 경계에 적용
- `state_schema`: subgraph 내부에서 사용할 전체 state
- `input_schema`: subgraph가 받는 public input key
- `output_schema`: subgraph가 부모에 반환하는 public output key
- `cleaned` 같은 자식 전용 scratch key는 부모 state로 누출되지 않는다.

그래프 구조
-----------
자식 그래프가 텍스트를 정리해 앞부분을 요약하고, 부모는 자식의 내부 cleaned 없이 요약 결과를 받는다.

parent: START ─▶ summarize_text(subgraph) ─▶ format_result ─▶ END
child : START ─▶ clean ─▶ summarize ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "text": "one two three four five six seven eight nine"
}
```
관찰할 결과: summary="one two three four five six seven eight...". 부모 결과에는 자식 전용 cleaned가 없습니다.
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
