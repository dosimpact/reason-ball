"""Native chat → SEC modeling Deep Agent using shared model and durable BFF tools."""

from deepagents import create_deep_agent
from langgraph.graph import END, START, StateGraph

from domains.sec_modeling_agent.tools import build_sec_modeling_test_tools
from graph.primary_graphs.sec_intelligent_ui.workflow import chat_model
from graph.primary_graphs.sec_modeling_agent.prompts import SYSTEM
from graph.primary_graphs.sec_modeling_agent.state import SecModelingAgentState


def build_sec_modeling_agent(
    *, model=None, client=None, activity=None, agent=None, tools=None
):
    """Inject dependencies for isolated validation; keep native callbacks/tool events."""
    business = agent or create_deep_agent(
        model=model or chat_model(),
        tools=tools
        if tools is not None
        else build_sec_modeling_test_tools(client=client, activity=activity),
        state_schema=SecModelingAgentState,
        system_prompt=SYSTEM,
        name="sec_modeling_business",
    )

    async def prepare(state):
        return {"presentation": None}

    graph = StateGraph(SecModelingAgentState)
    graph.add_node("prepare", prepare)
    graph.add_node("inspect_modeling", business)
    graph.add_edge(START, "prepare")
    graph.add_edge("prepare", "inspect_modeling")
    graph.add_edge("inspect_modeling", END)
    return graph.compile()


sec_modeling_agent = build_sec_modeling_agent()
