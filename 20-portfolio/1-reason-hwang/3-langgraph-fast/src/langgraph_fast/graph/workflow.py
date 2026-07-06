from typing import cast

from langgraph.graph import END, START, StateGraph

from langgraph_fast.graph.main.node.llm import call_llm
from langgraph_fast.graph.state import GraphState


def build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("call_llm", call_llm)
    graph.add_edge(START, "call_llm")
    graph.add_edge("call_llm", END)
    return graph.compile()


async def run_graph(message: str, provider_name: str = "openai") -> GraphState:
    app = build_graph()
    initial_state: GraphState = {
        "message": message,
        "provider": provider_name,
        "response": "",
    }
    return cast(GraphState, await app.ainvoke(initial_state))
