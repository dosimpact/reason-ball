"""Example 01: minimal OpenAI-backed graph for SDK connection practice."""

from __future__ import annotations

from langchain_core.messages import SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


SYSTEM_PROMPT = (
    "You are the LangGraph SDK connection example. Reply in one concise "
    "sentence and mention that the response came from an OpenAI-backed graph."
)


def call_model(state: MessagesState) -> dict:
    """Call OpenAI and append the response to message state."""
    llm = create_llm()
    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
    if isinstance(response.content, str) and "openai-backed graph" not in response.content.lower():
        response.content = (
            f"{response.content.rstrip()} "
            "This response came from an OpenAI-backed graph."
        )
    return {"messages": [response]}


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("call_model", call_model)
    builder.add_edge(START, "call_model")
    builder.add_edge("call_model", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    result = graph.invoke({"messages": [HumanMessage(content="Say hello.")]})
    print(result["messages"][-1].content)
