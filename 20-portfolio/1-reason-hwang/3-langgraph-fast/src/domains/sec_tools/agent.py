"""Model-selected SEC tool loop and verified adapters for the existing chat contract."""
from __future__ import annotations

from langchain_core.messages import SystemMessage, ToolMessage
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from domains.sec_tools.collection import collect_company_filings  # noqa: F401 - compatibility export
from domains.sec_tools.lookup import search_companies  # noqa: F401 - compatibility export
from domains.sec_tools.preparation import prepare_filing  # noqa: F401 - compatibility export


def build_tool_graph(model, tools, instruction):
    bound = model.bind_tools(tools)
    async def call_model(state):
        return {"messages": [await bound.ainvoke([SystemMessage(content=instruction), *state['messages']])]}
    graph = StateGraph(MessagesState)
    graph.add_node('model', call_model)
    graph.add_node('tools', ToolNode(tools, handle_tool_errors=True))
    graph.add_edge(START, 'model')
    graph.add_conditional_edges('model', tools_condition)
    graph.add_edge('tools', 'model')
    return graph.compile()


def artifacts(result, tool=None):
    return [message.artifact for message in result['messages'] if isinstance(message, ToolMessage)
            and isinstance(message.artifact, dict) and (tool is None or message.artifact.get('tool') == tool)]
