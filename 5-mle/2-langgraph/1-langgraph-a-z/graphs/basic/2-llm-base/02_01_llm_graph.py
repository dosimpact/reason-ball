"""
Example 02-01 — LLM을 한 번 호출하는 그래프.

쉽게 이해하기
-------------
LLM 노드는 모델에게 질문하고 받은 답을 state에 적는 작업이다.
SystemMessage에는 답변 지침을, HumanMessage에는 사용자 질문을 담는다.
이 예제는 answer 노드에서 모델을 한 번 호출한다.

새 개념
-------
- node 안에서 `llm.invoke()` 직접 호출
- `SystemMessage`와 `HumanMessage`로 모델 입력 구성
- LLM 응답 문자열을 일반 state에 저장

그래프 구조
-----------
사용자 질문을 모델에 전달하고, 생성한 답변을 answer에 저장한다.

START ─▶ answer ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "question": "LangGraph를 한 문장으로 설명해줘."
}
```
관찰할 결과: answer 문자열에 모델 응답이 저장됩니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
"""

from __future__ import annotations
from typing import TypedDict
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from common.llm import create_llm


class State(TypedDict, total=False):
    question: str
    answer: str


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


def build_graph():
    builder = StateGraph(State)
    builder.add_node("answer", answer)

    builder.add_edge(START, "answer")
    builder.add_edge("answer", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"question": "LangGraph를 한 문장으로 설명해줘."})["answer"])
