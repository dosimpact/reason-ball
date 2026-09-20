from typing import cast

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph

from graph.primary_graphs.simple_llm.node.llm import call_llm
from graph.primary_graphs.simple_llm.state import SimpleLlmState


def build_graph():
    graph = StateGraph(SimpleLlmState)
    graph.add_node("call_llm", call_llm)
    graph.add_edge(START, "call_llm")
    graph.add_edge("call_llm", END)
    return graph.compile()


simple_llm = build_graph()


async def run_simple_llm(message: str) -> SimpleLlmState:
    initial_state: SimpleLlmState = {
        "messages": [HumanMessage(content=message)],
    }
    return cast(SimpleLlmState, await simple_llm.ainvoke(initial_state))


def get_last_ai_message(state: SimpleLlmState) -> str:
    for message in reversed(state["messages"]):
        if isinstance(message, AIMessage):
            return message.content if isinstance(message.content, str) else str(message.content)
    return ""
