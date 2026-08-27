"""Example 17 — 기본 스트리밍 모드.

선행 개념
---------
- 단일 LLM 노드, ``MessagesState``, ``graph.invoke()``

새 개념
-------
- ``graph.stream(..., stream_mode="values")``: 각 스텝이 끝난 뒤의 전체 state
- ``graph.stream(..., stream_mode="updates")``: 각 노드가 만든 state update
- ``graph.stream(..., stream_mode="messages")``: LLM이 생성한
  ``(message_chunk, metadata)`` 튜플
- 여러 모드를 리스트로 넘기면 ``(mode, data)`` 튜플을 받는다는 점

복습 개념
---------
- ``START -> chat -> END`` 직선 그래프와 메시지 누적 reducer

``messages`` 모드는 LLM 노드의 최종 state만 잘게 나누는 기능이 아니라, 실행 중
모델이 생성하는 메시지 chunk를 전달한다. 반면 ``updates``는 토큰이 아니라 노드가
반환한 state 변경분을 전달한다.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


def chat(state: MessagesState) -> dict:
    """현재까지의 메시지를 모델에 전달하고 응답 하나를 추가한다."""
    response = create_llm().invoke(state["messages"])
    return {"messages": [response]}


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("chat", chat)
    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    return builder.compile()


graph = build_graph()


def demo_stream_modes(question: str = "LangGraph의 장점을 두 문장으로 설명해줘.") -> None:
    """동일한 입력을 세 모드로 각각 실행해 페이로드 차이를 보여준다."""
    payload = {"messages": [HumanMessage(content=question)]}

    print("=== updates: node -> partial state ===")
    for update in graph.stream(payload, stream_mode="updates"):
        print(update)

    print("\n=== values: full state after each step ===")
    for state in graph.stream(payload, stream_mode="values"):
        print(f"messages={len(state['messages'])}")

    print("\n=== messages: message chunks from LLM calls ===")
    for chunk, metadata in graph.stream(payload, stream_mode="messages"):
        if chunk.content:
            print(chunk.content, end="", flush=True)
        # metadata["langgraph_node"]으로 chunk를 만든 노드를 구분할 수 있다.
        _ = metadata.get("langgraph_node")
    print()


if __name__ == "__main__":
    demo_stream_modes()
