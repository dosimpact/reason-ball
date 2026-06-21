from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_02_routing.nodes import (
    clarification_handler,
    classify_route,
    format_response,
    order_status_handler,
    preprocess_input,
    product_info_handler,
    should_retry_router,
    technical_support_handler,
    validate_route,
)
from agentic_design_patterns.patterns.chapter_02_routing.state import RoutingState


def route_after_preprocess(
    state: RoutingState,
) -> Literal["classify_route", "clarification_handler"]:
    if state.get("route") == "clarify":
        return "clarification_handler"
    return "classify_route"


def route_after_classify(
    state: RoutingState,
) -> Literal["classify_route", "validate_route"]:
    if should_retry_router(state):
        return "classify_route"
    return "validate_route"


def route_by_decision(
    state: RoutingState,
) -> Literal[
    "order_status_handler",
    "product_info_handler",
    "technical_support_handler",
    "clarification_handler",
]:
    route = state.get("route")
    if route == "order_status":
        return "order_status_handler"
    if route == "product_info":
        return "product_info_handler"
    if route == "technical_support":
        return "technical_support_handler"
    return "clarification_handler"


builder = StateGraph(RoutingState)
builder.add_node("preprocess_input", preprocess_input)
builder.add_node("classify_route", classify_route)
builder.add_node("validate_route", validate_route)
builder.add_node("order_status_handler", order_status_handler)
builder.add_node("product_info_handler", product_info_handler)
builder.add_node("technical_support_handler", technical_support_handler)
builder.add_node("clarification_handler", clarification_handler)
builder.add_node("format_response", format_response)

builder.add_edge(START, "preprocess_input")
builder.add_conditional_edges(
    "preprocess_input",
    route_after_preprocess,
    {
        "classify_route": "classify_route",
        "clarification_handler": "clarification_handler",
    },
)
builder.add_conditional_edges(
    "classify_route",
    route_after_classify,
    {
        "classify_route": "classify_route",
        "validate_route": "validate_route",
    },
)
builder.add_conditional_edges(
    "validate_route",
    route_by_decision,
    {
        "order_status_handler": "order_status_handler",
        "product_info_handler": "product_info_handler",
        "technical_support_handler": "technical_support_handler",
        "clarification_handler": "clarification_handler",
    },
)
builder.add_edge("order_status_handler", "format_response")
builder.add_edge("product_info_handler", "format_response")
builder.add_edge("technical_support_handler", "format_response")
builder.add_edge("clarification_handler", "format_response")
builder.add_edge("format_response", END)

graph = builder.compile()
