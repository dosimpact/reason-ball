"""
Example 01-01 — 가장 단순한 그래프. (✅학습완료)

쉽게 이해하기
-------------
State는 노드들이 함께 읽고 갱신하는 작업 메모다. 노드는 작업 함수, edge는 작업 순서다.
예: uppercase가 글자를 대문자로 바꾸고 exclaim이 !를 붙인다.
StateGraph에 이 순서를 등록하고 compile()하면 invoke()로 실행할 수 있다.

LangGraph 의 핵심 컨셉만 보여주는 "Hello, LangGraph" 예제입니다.
LLM / tool 없이 두 개의 일반 함수 노드를 직선으로 연결합니다.

새 개념
-------
- `StateGraph` + `TypedDict` 로 커스텀 상태 정의
- 노드 = state 를 입력받아 부분 dict 를 반환하는 함수
- `add_edge(START, ...)`, `add_edge(..., END)` 로 흐름 정의
- `compile()` 호출 후 `invoke()` 로 실행


그래프 구조
-----------
입력 텍스트를 대문자로 바꾸고 느낌표를 붙인 뒤, 실행한 단계 목록과 함께 반환한다.

START ─▶ uppercase ─▶ exclaim ─▶ END

테스트 입력 예시 (state = {"text": str, "steps": list[str]})
----------------------------------------------------------
- {"text": "hello langgraph", "steps": []}      → "HELLO LANGGRAPH!"
- {"text": "good morning",    "steps": []}      → "GOOD MORNING!"
- {"text": "한글도 됨",        "steps": []}      → "한글도 됨!"  (대문자 변환은 영문만)

"""

from __future__ import annotations
from typing import TypedDict
from langgraph.graph import END, START, StateGraph

class State(TypedDict):
    text: str
    steps: list[str]


def uppercase(state: State) -> dict:
    """입력 텍스트를 대문자로 변환합니다."""

    # 📕
    # - state["<key>"]
    # - state.get("<key>", <default value> )
    # new_text = state["text"].upper() # 필수 입력, 없으면 애러
    new_text = state.get("text", "no input").upper()  # 디폴트 값

    return {"text": new_text, "steps": state.get("steps", []) + ["uppercase"]}


def exclaim(state: State) -> dict:
    """문장 끝에 ! 를 붙입니다."""
    new_text = state["text"] + "!"
    return {"text": new_text, "steps": state.get("steps", []) + ["exclaim"]}


def build_graph():
    builder = StateGraph(State)

    builder.add_node("uppercase", uppercase)
    builder.add_node("exclaim", exclaim)

    builder.add_edge(START, "uppercase")
    builder.add_edge("uppercase", "exclaim")
    builder.add_edge("exclaim", END)

    return builder.compile()


# LangGraph Studio 진입점
graph = build_graph()


if __name__ == "__main__":
    result = graph.invoke({"text": "hello langgraph", "steps": []})
    print(result)  # {'text': 'HELLO LANGGRAPH!', 'steps': ['uppercase', 'exclaim']}
