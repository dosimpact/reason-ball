"""
Example 02-03 — Command로 state update와 routing을 함께 반환하기.

쉽게 이해하기
-------------
Command는 작업 결과와 다음 목적지를 한 번에 돌려주는 객체다.
예: 값을 갱신하면서 양수 처리 노드로 이동한다.
update에는 바꿀 값을, goto에는 이어서 실행할 노드 이름을 넣는다.

새 개념
-------
- `Command(update=..., goto=...)` : node가 state 변경과 다음 node 결정을 한 번에 수행
- `Command[Literal[...]]`로 가능한 목적지를 타입에 표시

그래프 구조
-----------
점수가 0 이상인지에 따라 Command로 경로를 선택하고, 해당 분기에서 점수 설명 메시지를 만든다.

              ┌─▶ positive ─┐
START ─▶ route               ├─▶ END
              └─▶ negative ─┘

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "score": 3
}
```
관찰할 결과: route="positive", message="score 3 is non-negative".

추가 입력(JSON):
```json
{
  "score": -1
}
```
관찰할 결과: route="negative", message="score -1 is negative".
"""

from __future__ import annotations
from typing import Literal, TypedDict
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command


class State(TypedDict, total=False):
    score: int
    route: str
    message: str


def route(state: State) -> Command[Literal["positive", "negative"]]:
    destination = "positive" if state["score"] >= 0 else "negative"
    return Command(update={"route": destination}, goto=destination)


def positive(state: State) -> dict:
    return {"message": f"score {state['score']} is non-negative"}


def negative(state: State) -> dict:
    return {"message": f"score {state['score']} is negative"}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("route", route)
    builder.add_node("positive", positive)
    builder.add_node("negative", negative)

    builder.add_edge(START, "route")
    builder.add_edge("positive", END)
    builder.add_edge("negative", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"score": 3}))
    print(graph.invoke({"score": -1}))
