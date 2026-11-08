"""
Example 01-02 — 노드의 부분 state update. (✅학습완료)

쉽게 이해하기
-------------
부분 update는 작업 메모 전체 대신 바꿀 항목만 반환하는 방식이다.
예: normalize는 normalized만, measure는 length만 반환한다.
반환하지 않은 text는 그대로 남고, 다음 노드는 갱신된 메모를 읽는다.

새 개념
-------
- 다음 노드는 앞 노드의 update된 state를 받음
- 노드는 상태를 key로 접근해서 업데이트 가능.


그래프 구조
-----------
입력 텍스트의 양끝 공백을 제거하고 소문자로 바꾼 뒤, 원문을 유지하면서 가공한 문자열과 길이를 저장한다.

START ─▶ normalize ─▶ measure ─▶ END

테스트 입력 예시 (입력 text는 유지되고 normalized와 length만 갱신됨)
-----------------------------------------------------------------
- {"text": "  Hi  ", "normalized": "old", "length": 99}
  → {"text": "  Hi  ", "normalized": "hi", "length": 2}
  (기존 normalized와 length는 새 값으로 덮어씀)
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
