"""
Example 01-03 — reducer로 state 값을 누적하기. (✅학습완료)

reducer란?
----------
state에 새 값이 들어왔을 때, 기존 값과 어떻게 합칠지 정하는 규칙이다.

이 예제는 "작업 이력을 이어 붙이는 규칙"을 사용한다.
- 기존 이력: ["clean"]
- 새 이력:   ["enrich"]
- 합친 이력: ["clean", "enrich"]

    steps: Annotated[list[str], operator.add]

위 선언은 "steps는 리스트이며, 새 항목을 기존 리스트 뒤에 붙인다"는 뜻이다.
이 규칙이 없으면 새 값 ["enrich"]로 바뀌어 이전 이력은 사라진다.
따라서 노드는 기존 이력 전체가 아니라 이번 항목만 반환한다.

새 개념
-------
- `Annotated[value_type, reducer]`로 key별 병합 규칙 선언
- 여러 노드가 반환한 list를 `operator.add`로 누적
- reducer가 없는 key의 overwrite와 reducer key의 merge 비교

그래프 구조
-----------
입력 텍스트의 공백을 정리하고 느낌표를 붙이면서, 두 노드의 작업 이력을 리스트에 누적한다.

START ─▶ clean ─▶ enrich ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "text": "  hello  ",
  "steps": []
}
```
관찰할 결과: text="hello!", status="enriched", steps=["clean", "enrich"]. 기존 steps가 있으면 뒤에 누적됩니다.
"""

import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    text: str
    status: str  # 별도 reducer 없음: 반환된 새 값으로 교체한다.
    steps: Annotated[list[str], operator.add]  # 기존 리스트 + 이번 update 리스트


def clean(state: State) -> dict:
    # 전체 state 대신 변경분만 반환한다. steps 병합은 LangGraph가 처리한다.
    return {
        "text": state["text"].strip(),
        "status": "cleaned",
        "steps": ["clean"],
    }


def enrich(state: State) -> dict:
    return {
        "text": f"{state['text']}!",
        "status": "enriched",
        "steps": ["enrich"],  # 기존 steps를 넣지 않고 이번 항목만 보낸다.
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
