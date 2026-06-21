"""
Example 02 — LLM 한 번 호출하는 그래프.

01 위에 LLM 노드 한 개를 얹은 가장 단순한 챗봇입니다. 도구는 아직 없습니다.

학습 포인트
-----------
- `MessagesState` (built-in TypedDict, `messages: Annotated[list, add_messages]`)
  를 사용해 메시지 누적을 자동화
- 노드가 `{"messages": [AIMessage(...)]}` 를 반환하면 reducer 가 기존 list 에 append
- LLM 노드는 `node.llm_node.make_call_model` 팩토리로 표준화

그래프 구조
-----------
START ─▶ chat ─▶ END

테스트 메시지 예시 (state = MessagesState)
-----------------------------------------
LangGraph Studio 의 messages 입력에 다음 중 하나를 넣어보세요.
- "안녕! 한 줄로 인사해줘."
- "LangGraph 가 뭐야? 한 문장으로 설명해줘."
- "오늘 기분이 좋아지는 짧은 명언 하나만."
- "Tell me a fun fact in one sentence."
"""

from __future__ import annotations

from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm
from node.llm_node import make_call_model


def build_graph():
    llm = create_llm()
    chat_node = make_call_model(
        llm,
        system_prompt=(
            "You are a friendly assistant. Reply concisely in the user's language."
        ),
    )

    builder = StateGraph(MessagesState)
    
    builder.add_node("chat", chat_node)

    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    out = graph.invoke({"messages": [HumanMessage(content="안녕! 한 줄로 인사해줘.")]})
    print(out["messages"][-1].content)
