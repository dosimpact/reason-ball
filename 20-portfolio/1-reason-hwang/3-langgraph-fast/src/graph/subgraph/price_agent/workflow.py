"""Compiled independent LangGraph workflow for the price agent."""

from __future__ import annotations

from typing import cast

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from graph.subgraph.price_agent.node import (
    collect_price_data,
    extract_request,
    format_response,
)
from graph.subgraph.price_agent.state import PriceAgentState
from graph.subgraph.price_agent.tools import get_historical_prices


def route_after_extract(state: PriceAgentState) -> str:
    if state.get("error_code"):
        return "format_response"
    for message in reversed(state.get("messages", [])):
        if isinstance(message, AIMessage):
            return "yahoo_finance_tools" if message.tool_calls else "format_response"
    return "format_response"


def build_price_agent_graph():
    graph = StateGraph(PriceAgentState)
    graph.add_node("extract_request", extract_request)
    graph.add_node(
        "yahoo_finance_tools",
        ToolNode([get_historical_prices], handle_tool_errors=True),
    )
    graph.add_node("collect_price_data", collect_price_data)
    graph.add_node("format_response", format_response)
    graph.add_edge(START, "extract_request")
    graph.add_conditional_edges(
        "extract_request",
        route_after_extract,
        {
            "yahoo_finance_tools": "yahoo_finance_tools",
            "format_response": "format_response",
        },
    )
    graph.add_edge("yahoo_finance_tools", "collect_price_data")
    graph.add_edge("collect_price_data", "format_response")
    graph.add_edge("format_response", END)
    return graph.compile()


price_agent_graph = build_price_agent_graph()


async def run_price_agent(message: str) -> PriceAgentState:
    initial_state: PriceAgentState = {
        "messages": [HumanMessage(content=message)],
        "query": message,
        "interval": "1d",
        "count": 10,
        "prices": [],
        "error_code": None,
        "error_message": None,
    }
    result = await price_agent_graph.ainvoke(initial_state)
    return cast(PriceAgentState, result)
