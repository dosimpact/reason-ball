"""Example 02: checkpointed multi-turn chat graph.

쉽게 이해하기
-------------
다중 턴 채팅은 이전 대화를 이어서 질문하고 답하는 것이다.
예: 이름을 말한 뒤 다음 질문에서 그 이름을 다시 물어본다.
서버가 같은 thread의 대화를 복원하고 chat 노드가 그 이력을 모델에 전달한다.

그래프 구조
-----------
같은 thread의 이전 대화를 모델에 전달해 응답하고, 새 메시지를 누적해 다중 턴 대화를 이어간다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "My code word is cobalt."
    }
  ]
}
```
관찰할 결과: 동일 thread에 "What is my code word?"를 보내 대화 상태의 누적을 확인합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
서버는 thread를 유지합니다. Python 단독 실습은 main의 local_graph/MemorySaver와 같은 thread_id를 사용합니다.
"""
# 예제 개요: 같은 thread의 대화 이력을 모델에 전달하는 다중 턴 채팅 예제입니다.
# 핵심 흐름: 서버가 체크포인트를 관리하며, 단독 실행 예제는 MemorySaver를 따로 연결합니다.

from __future__ import annotations

from langchain_core.messages import SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


SYSTEM_PROMPT = (
    "You are the Basic Chat UI example for LangGraph SDK learners. "
    "Reply concisely in the user's language. Use the conversation history "
    "from the current thread when answering follow-up questions."
)


# 누적 대화 메시지를 모델에 전달하고 새 응답을 메시지 상태에 추가합니다.
def chat(state: MessagesState) -> dict:
    """Call OpenAI with accumulated thread messages."""
    llm = create_llm()
    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
    return {"messages": [response]}


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("chat", chat)
    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    return builder.compile()


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
if __name__ == "__main__":
    from langchain_core.messages import HumanMessage
    from langgraph.checkpoint.memory import MemorySaver

    # `langgraph dev` injects checkpointing; standalone demos need an explicit saver.
    builder = StateGraph(MessagesState)
    builder.add_node("chat", chat)
    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    local_graph = builder.compile(checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": "demo"}}
    local_graph.invoke({"messages": [HumanMessage(content="My code word is cobalt.")]}, config=cfg)
    result = local_graph.invoke(
        {"messages": [HumanMessage(content="What is my code word?")]},
        config=cfg,
    )
    print(result["messages"][-1].content)
