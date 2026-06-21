"""Example 02: checkpointed multi-turn chat graph."""

from __future__ import annotations

from langchain_core.messages import SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


SYSTEM_PROMPT = (
    "You are the Basic Chat UI example for LangGraph SDK learners. "
    "Reply concisely in the user's language. Use the conversation history "
    "from the current thread when answering follow-up questions."
)


def chat(state: MessagesState) -> dict:
    """Call OpenAI with accumulated thread messages."""
    llm = create_llm()
    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
    return {"messages": [response]}


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("chat", chat)
    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    return builder.compile()


graph = build_graph()


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
