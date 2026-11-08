"""
Example 05-03 — 가장 단순한 subgraph 조합.

쉽게 이해하기
-------------
Subgraph는 여러 단계를 작은 그래프로 묶어 큰 그래프 안에서 쓰는 것이다.
예: 글의 공백을 정리하고 <hello>처럼 꾸미는 작업을 하나로 묶는다.
compile한 그래프도 실행 가능한 객체이므로 add_node()에 넣을 수 있다.

새 개념
-------
- 컴파일된 graph도 Runnable이므로 다른 graph의 node로 등록할 수 있다.
- 부모와 자식이 같은 state schema를 쓰면 공유 key가 자연스럽게 전달된다.

그래프 구조
-----------
자식 그래프로 텍스트의 공백과 대소문자를 정리하고 꺾쇠로 꾸민 뒤, 부모에서 최종 결과를 만든다.

parent: START ─▶ prepare ─▶ text_pipeline(subgraph) ─▶ finalize ─▶ END
child : START ─▶ normalize ─▶ decorate ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "text": "  Hello    LangGraph  "
}
```
관찰할 결과: normalized="hello langgraph", decorated="<hello langgraph>", result="subgraph result: <hello langgraph>".
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
