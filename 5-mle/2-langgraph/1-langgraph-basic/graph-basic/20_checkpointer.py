"""Example 20 — Checkpointer와 thread 단위 대화 상태.

선행 개념
---------
- ``MessagesState``와 메시지 reducer

새 개념
-------
- ``compile(checkpointer=InMemorySaver())``
- ``configurable.thread_id``로 실행 상태 저장·복원·격리
- 같은 thread에는 과거 메시지가 누적되고 다른 thread에는 섞이지 않는다는 점

복습 개념
---------
- ``START -> chat -> END`` 직선 그래프와 반복 invoke

이 예제는 체크포인터 자체에 집중하기 위해 LLM과 Tool/ReAct를 사용하지 않는다.
``chat`` 노드는 현재 thread에서 보이는 사용자 메시지 수를 결정론적으로 답한다.
LangGraph API/Studio는 서버가 checkpointer를 제공하므로 공개 ``graph``에는 별도의
saver를 넣지 않고, 단독 실행에서만 ``InMemorySaver``를 주입한다.
"""

from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, MessagesState, StateGraph


def chat(state: MessagesState) -> dict:
    """현재 thread에서 누적된 사용자 메시지 수를 답한다."""
    human_messages = [
        message for message in state["messages"] if isinstance(message, HumanMessage)
    ]
    latest = human_messages[-1].content if human_messages else ""
    return {
        "messages": [
            AIMessage(
                content=f"turn={len(human_messages)}; latest={latest}",
            )
        ]
    }


def build_graph(*, checkpointer: BaseCheckpointSaver | None = None):
    builder = StateGraph(MessagesState)
    builder.add_node("chat", chat)
    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    return builder.compile(checkpointer=checkpointer)


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import InMemorySaver

    standalone = build_graph(checkpointer=InMemorySaver())
    thread_a = {"configurable": {"thread_id": "thread-a"}}
    thread_b = {"configurable": {"thread_id": "thread-b"}}

    standalone.invoke(
        {"messages": [HumanMessage(content="첫 번째 메시지")]}, config=thread_a
    )
    second = standalone.invoke(
        {"messages": [HumanMessage(content="두 번째 메시지")]}, config=thread_a
    )
    isolated = standalone.invoke(
        {"messages": [HumanMessage(content="별도 thread 메시지")]}, config=thread_b
    )

    print(second["messages"][-1].content)  # turn=2
    print(isolated["messages"][-1].content)  # turn=1
