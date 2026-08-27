"""
Example 08 — LLM을 한 번 호출하는 그래프.

선행 예제
---------
- 02_state_updates

새 개념
-------
- node 안에서 `llm.invoke()` 직접 호출
- `SystemMessage`와 `HumanMessage`로 모델 입력 구성
- LLM 응답 문자열을 일반 state에 저장

복습 개념
---------
- `TypedDict`, 부분 state update, 직선 graph

그래프 구조
-----------
START ─▶ answer ─▶ END
"""

from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


class State(TypedDict, total=False):
    question: str
    answer: str


def build_graph():
    llm = create_llm()

    def answer(state: State) -> dict:
        response = llm.invoke(
            [
                SystemMessage(
                    content="Reply concisely in the user's language."
                ),
                HumanMessage(content=state["question"]),
            ]
        )
        return {"answer": str(response.content)}

    builder = StateGraph(State)
    builder.add_node("answer", answer)
    builder.add_edge(START, "answer")
    builder.add_edge("answer", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"question": "LangGraph를 한 문장으로 설명해줘."})["answer"])
