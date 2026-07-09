from graph.shared.provider import get_provider
from graph.main_graph.state import GraphState


async def call_llm(state: GraphState) -> dict[str, str]:
    provider = get_provider(state["provider"])
    response = await provider.complete(state["message"])
    return {"response": response}
