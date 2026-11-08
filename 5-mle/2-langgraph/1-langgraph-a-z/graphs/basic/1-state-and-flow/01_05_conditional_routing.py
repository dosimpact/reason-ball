"""
Example 01-05 — 조건부 edge로 경로 선택하기.

쉽게 이해하기
-------------
조건부 edge는 입력에 따라 다음에 할 일을 고르는 갈림길이다.
예: 짝수는 even 노드의 handle_even 함수, 홀수는 handle_odd로 보낸다.
라우팅 함수가 고른 이름을 add_conditional_edges()의 목적지와 연결한다.

새 개념
-------
- routing 함수는 state를 읽고 다음 경로 이름을 반환
- `add_conditional_edges()`의 반환값과 node mapping
- `Literal`로 가능한 경로를 명시

그래프 구조
-----------
입력 숫자가 짝수인지 홀수인지 판별한 뒤, 해당 경로에서 결과 메시지를 만든다.

                 ┌─▶ even ────────┐
START ─▶ classify                 ├─▶ END
                 └─▶ handle_odd ──┘

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "number": 7
}
```
관찰할 결과: category="odd", message="7 is odd".

추가 입력(JSON):
```json
{
  "number": 12
}
```
관찰할 결과: category="even", message="12 is even".
"""

from __future__ import annotations
from typing import Literal, TypedDict
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    number: int
    category: str
    message: str


def classify(state: State) -> dict:
    return {"category": "even" if state["number"] % 2 == 0 else "odd"}


def route_by_category(state: State) -> Literal["handle_even", "handle_odd"]:
    return "handle_even" if state["category"] == "even" else "handle_odd"


def handle_even(state: State) -> dict:
    return {"message": f"{state['number']} is even"}


def handle_odd(state: State) -> dict:
    return {"message": f"{state['number']} is odd"}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("classify", classify)
    builder.add_node("even", handle_even)
    builder.add_node("handle_odd", handle_odd)

    builder.add_edge(START, "classify")
    builder.add_conditional_edges(
        "classify",
        route_by_category,
        {"handle_even": "even", "handle_odd": "handle_odd"},
    )
    builder.add_edge("even", END)
    builder.add_edge("handle_odd", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"number": 7}))
    print(graph.invoke({"number": 12}))
