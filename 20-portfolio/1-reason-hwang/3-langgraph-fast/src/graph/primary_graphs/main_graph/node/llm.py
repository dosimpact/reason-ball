from graph.primary_graphs.main_graph.state import GraphState
from graph.provider import get_provider


async def call_llm(state: GraphState) -> dict[str, str]:
    provider = get_provider(state["provider"])
    response = await provider.complete(state["message"])
    return {"response": response}
