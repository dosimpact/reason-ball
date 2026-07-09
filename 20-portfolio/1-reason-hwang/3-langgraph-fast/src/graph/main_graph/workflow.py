from typing import cast

from langgraph.graph import END, START, StateGraph

from graph.main_graph.node.llm import call_llm
from graph.main_graph.state import GraphState


def build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("call_llm", call_llm)
    graph.add_edge(START, "call_llm")
    graph.add_edge("call_llm", END)
    return graph.compile()


main_graph = build_graph()


async def run_graph(message: str, provider_name: str = "openai") -> GraphState:
    initial_state: GraphState = {
        "message": message,
        "provider": provider_name,
        "response": "",
    }
    return cast(GraphState, await main_graph.ainvoke(initial_state))
