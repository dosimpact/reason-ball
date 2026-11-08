"""
Example 01-06 — cycle과 명시적인 종료 조건.

쉽게 이해하기
-------------
Cycle은 끝난 작업으로 다시 돌아오는 반복 경로다.
예: 숫자를 하나씩 줄이다가 0이 되면 반복을 끝낸다.
종료 조건이 정상 흐름을 정하고 recursion_limit은 반복이 끝나지 않을 때 실행을 멈춘다.

새 개념
-------
- node에서 자기 자신으로 돌아가는 cycle 컨셉 
- state와 config의 차이점 ? 그래프의 흐름에 관여하는 변수라면 state 로 넣고, env와 같은 런타님 변수는 config에 넣는다. 
- config 예, max_concurrency, max loop limit 등  => config 값이 더 적절함.  

그래프 구조
-----------
남은 숫자를 하나씩 줄이며 방문 이력을 쌓고, 0 이하가 되면 이력을 담은 결과를 만든다.

START ─▶ countdown ─┬─▶ countdown
                    └─▶ finish ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "remaining": 3,
  "visited": []
}
```
관찰할 결과: remaining=0, visited=[3, 2, 1], result="visited=[3, 2, 1]".

실행 조건·방법:
config={"recursion_limit": 10}으로 실행합니다. 큰 remaining에 지나치게 작은 제한을 주면 GraphRecursionError가 발생합니다.
"""

import operator
from typing import Annotated, Literal, TypedDict
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    remaining: int
    visited: Annotated[list[int], operator.add]
    result: str


def countdown(state: State) -> dict:
    current = state["remaining"]
    return {"remaining": current - 1, "visited": [current]}


def continue_or_finish(state: State) -> Literal["countdown", "finish"]:
    return "countdown" if state["remaining"] > 0 else "finish"


def finish(state: State) -> dict:
    return {"result": f"visited={state.get('visited', [])}"}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("countdown", countdown)
    builder.add_node("finish", finish)

    builder.add_edge(START, "countdown")
    builder.add_conditional_edges(
        "countdown",
        continue_or_finish,
        {"countdown": "countdown", "finish": "finish"},
    )
    builder.add_edge("finish", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"remaining": 3, "visited": []}, config={"recursion_limit": 10}))
