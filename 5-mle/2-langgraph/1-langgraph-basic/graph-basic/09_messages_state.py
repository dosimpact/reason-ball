"""
Example 09 — MessagesState와 메시지 reducer.

선행 예제
---------
- 03_reducers
- 08_llm_graph

새 개념
-------
- `MessagesState`는 `messages`와 `add_messages` reducer를 제공
- node가 새 메시지만 반환해도 기존 대화 뒤에 병합됨
- LangChain message 객체와 role/content dict를 함께 입력 가능

복습 개념
---------
- reducer, `llm.invoke()`, 부분 state update

그래프 구조
-----------
START ─▶ chat ─▶ END
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


def build_graph():
    llm = create_llm()

    def chat(state: MessagesState) -> dict:
        response = llm.invoke(
            [SystemMessage(content="Reply briefly in the user's language.")]
            + state["messages"]
        )
        # add_messages reducer가 이 새 메시지를 기존 messages 뒤에 병합합니다.
        return {"messages": [response]}

    builder = StateGraph(MessagesState)
    builder.add_node("chat", chat)
    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    result = graph.invoke(
        {"messages": [HumanMessage(content="안녕! 한 줄로 인사해줘.")]}
    )
    for message in result["messages"]:
        print(type(message).__name__, message.content)
