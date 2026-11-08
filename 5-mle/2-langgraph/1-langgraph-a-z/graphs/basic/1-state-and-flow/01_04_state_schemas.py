"""
Example 01-04 — 입력·내부·출력 state schema 분리.

쉽게 이해하기
-------------
State schema는 그래프가 사용하는 항목과 타입의 설계도다.
예: text를 입력받고, 내부에서는 normalized로 가공한 뒤 result만 돌려준다.
input_schema와 output_schema로 외부에 주고받을 항목을 나눈다.

새 개념
-------
- `state_schema`: 그래프 내부에서 사용하는 전체 state
- `input_schema`: 호출자가 입력할 수 있는 필드
- `output_schema`: 호출자에게 반환할 필드
- 내부 scratch 필드를 외부 contract에서 숨기는 방법

그래프 구조
-----------
입력 이름의 공백과 대소문자를 정리해 인사말을 만들고, 기본 최종 반환값에는 result만 포함한다.

START ─▶ prepare ─▶ format_result ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "text": "  langgraph learner  "
}
```
관찰할 결과: 출력은 {"result": "Hello, Langgraph Learner!"}. 내부 normalized는 출력 schema에서 제외됩니다.
"""

from __future__ import annotations

from typing import NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph


class InputState(TypedDict):
    text: str


class OutputState(TypedDict):
    result: str


class State(TypedDict):
    text: str
    result: str
    normalized: NotRequired[str]


def prepare(state: State) -> dict:
    return {"normalized": state["text"].strip().title()}


def format_result(state: State) -> dict:
    return {"result": f"Hello, {state['normalized']}!"}


def build_graph():
    builder = StateGraph(
        State,
        input_schema=InputState,
        output_schema=OutputState, # graph.invoke 에서 리턴되는 상태값
    )
    builder.add_node("prepare", prepare)
    builder.add_node("format_result", format_result)

    builder.add_edge(START, "prepare")
    builder.add_edge("prepare", "format_result")
    builder.add_edge("format_result", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"text": "  langgraph learner  "}))

    # output_schema 는 graph.invoke 에만 적용되니, 아래처럼 스트리밍에서도 result 필드만 내보내도록 한다.
    for chunk in graph.stream(
        {"text": "  langgraph learner  "},
        stream_mode="values",
        output_keys=["result"],
    ):
        print(chunk)
