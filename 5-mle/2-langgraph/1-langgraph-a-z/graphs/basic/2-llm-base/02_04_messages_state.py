"""
Example 02-04 — MessagesState와 메시지 reducer.

쉽게 이해하기
-------------
MessagesState는 messages라는 대화 목록을 기본으로 가진 state다.
예: "안녕"이라는 새 메시지를 반환하면 add_messages가 기존 대화에 합친다.
같은 ID의 메시지는 갱신할 수 있어 단순 리스트 이어 붙이기와 동작이 다르다.

새 개념
-------
- `MessagesState`는 `messages`와 `add_messages` reducer를 제공
- node가 새 메시지만 반환해도 기존 대화 뒤에 병합됨
- LangChain message 객체와 role/content dict를 함께 입력 가능

그래프 구조
-----------
누적된 대화 메시지를 모델에 전달하고, 새 응답을 기존 messages 목록에 추가한다.

START ─▶ chat ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "안녕! 한 줄로 인사해줘."
    }
  ]
}
```
관찰할 결과: messages에 사용자 메시지와 새 AIMessage가 함께 남습니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


llm = create_llm()


def chat(state: MessagesState) -> dict:
    response = llm.invoke(
        [SystemMessage(content="Reply briefly in the user's language.")]
        + state["messages"]
    )
    # add_messages reducer가 이 새 메시지를 기존 messages 뒤에 병합합니다.
    return {"messages": [response]}


def build_graph():
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
