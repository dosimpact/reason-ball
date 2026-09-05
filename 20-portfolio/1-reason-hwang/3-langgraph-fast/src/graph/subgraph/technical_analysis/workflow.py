from __future__ import annotations

from typing import cast

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from domains.technical_analysis.ports import TechnicalAnalysisEngine
from graph.shared.value_objects import PriceData
from graph.subgraph.technical_analysis.composition import build_default_dependencies
from graph.subgraph.technical_analysis.node import (
    create_call_model_node,
    render_input_error,
    validate_price,
)
from graph.subgraph.technical_analysis.routing import route_after_validation
from graph.subgraph.technical_analysis.state import TechnicalAnalysisState
from graph.subgraph.technical_analysis.tools import create_analyze_ohlcv_tool


def build_technical_analysis_graph(
    *,
    model: BaseChatModel | None = None,
    engine: TechnicalAnalysisEngine | None = None,
):
    if model is None or engine is None:
        default_model, default_engine = build_default_dependencies()
        model = model or default_model
        engine = engine or default_engine

    analysis_tool = create_analyze_ohlcv_tool(engine)
    call_model = create_call_model_node(model, analysis_tool)

    graph = StateGraph(TechnicalAnalysisState)
    graph.add_node("validate_price", validate_price)
    graph.add_node("render_input_error", render_input_error)
    # LangGraph accepts async closures; its current StateNode typing rejects this valid shape.
    graph.add_node("call_model", call_model)  # pyright: ignore[reportArgumentType]
    graph.add_node("tools", ToolNode([analysis_tool]))
    graph.add_edge(START, "validate_price")
    graph.add_conditional_edges(
        "validate_price",
        route_after_validation,
        {
            "call_model": "call_model",
            "render_input_error": "render_input_error",
        },
    )
    graph.add_edge("render_input_error", END)
    graph.add_conditional_edges(
        "call_model",
        tools_condition,
        {"tools": "tools", END: END},
    )
    graph.add_edge("tools", "call_model")
    return graph.compile()


technical_analysis_graph = build_technical_analysis_graph()


async def run_technical_analysis_graph(
    message: str,
    prices: list[PriceData],
    interval: str = "1d",
) -> TechnicalAnalysisState:
    initial_state: TechnicalAnalysisState = {
        "messages": [HumanMessage(content=message)],
        "prices": [price.to_json_dict() for price in prices],
        "interval": interval,
        "analysis_result": None,
        "validation_errors": [],
    }
    result = await technical_analysis_graph.ainvoke(initial_state)
    return cast(TechnicalAnalysisState, result)
