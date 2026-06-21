from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_10_model_context_protocol.nodes import (
    answer_without_mcp,
    build_mcp_request,
    classify_intent,
    discover_capabilities,
    generate_final_response,
    has_discovered_capabilities,
    integrate_result,
    invocation_needs_review,
    invoke_mcp_capability,
    mark_needs_review,
    preprocess_request,
    select_capability,
    should_retry_invocation,
    validate_capability,
)
from agentic_design_patterns.patterns.chapter_10_model_context_protocol.state import (
    MCPState,
)


def route_after_preprocess(
    state: MCPState,
) -> Literal["classify_intent", "generate_final_response"]:
    if state.get("status") == "failed":
        return "generate_final_response"
    return "classify_intent"


def route_after_classification(
    state: MCPState,
) -> Literal["answer_without_mcp", "discover_capabilities"]:
    if state.get("operation_type") == "none":
        return "answer_without_mcp"
    return "discover_capabilities"


def route_after_discovery(
    state: MCPState,
) -> Literal["select_capability", "answer_without_mcp"]:
    if state.get("status") == "fallback" or not has_discovered_capabilities(state):
        return "answer_without_mcp"
    return "select_capability"


def route_after_selection(
    state: MCPState,
) -> Literal["validate_capability", "answer_without_mcp"]:
    if state.get("selected_capability"):
        return "validate_capability"
    return "answer_without_mcp"


def route_after_validation(
    state: MCPState,
) -> Literal["build_mcp_request", "answer_without_mcp", "mark_needs_review"]:
    validation = state.get("capability_validation", {})
    if validation.get("status") == "needs_review":
        return "mark_needs_review"
    if validation.get("allowed"):
        return "build_mcp_request"
    return "answer_without_mcp"


def route_after_invocation(
    state: MCPState,
) -> Literal["integrate_result", "select_capability", "mark_needs_review", "answer_without_mcp"]:
    result = state.get("mcp_result") or {}
    if result.get("success"):
        return "integrate_result"
    if invocation_needs_review(state):
        return "mark_needs_review"
    if should_retry_invocation(state):
        return "select_capability"
    return "answer_without_mcp"


def route_after_integration(
    state: MCPState,
) -> Literal["generate_final_response", "mark_needs_review"]:
    if state.get("status") == "needs_review" or state.get("needs_human_review"):
        return "mark_needs_review"
    return "generate_final_response"


builder = StateGraph(MCPState)
builder.add_node("preprocess_request", preprocess_request)
builder.add_node("classify_intent", classify_intent)
builder.add_node("discover_capabilities", discover_capabilities)
builder.add_node("select_capability", select_capability)
builder.add_node("validate_capability", validate_capability)
builder.add_node("build_mcp_request", build_mcp_request)
builder.add_node("invoke_mcp_capability", invoke_mcp_capability)
builder.add_node("integrate_result", integrate_result)
builder.add_node("answer_without_mcp", answer_without_mcp)
builder.add_node("mark_needs_review", mark_needs_review)
builder.add_node("generate_final_response", generate_final_response)

builder.add_edge(START, "preprocess_request")
builder.add_conditional_edges(
    "preprocess_request",
    route_after_preprocess,
    {
        "classify_intent": "classify_intent",
        "generate_final_response": "generate_final_response",
    },
)
builder.add_conditional_edges(
    "classify_intent",
    route_after_classification,
    {
        "answer_without_mcp": "answer_without_mcp",
        "discover_capabilities": "discover_capabilities",
    },
)
builder.add_conditional_edges(
    "discover_capabilities",
    route_after_discovery,
    {
        "select_capability": "select_capability",
        "answer_without_mcp": "answer_without_mcp",
    },
)
builder.add_conditional_edges(
    "select_capability",
    route_after_selection,
    {
        "validate_capability": "validate_capability",
        "answer_without_mcp": "answer_without_mcp",
    },
)
builder.add_conditional_edges(
    "validate_capability",
    route_after_validation,
    {
        "build_mcp_request": "build_mcp_request",
        "answer_without_mcp": "answer_without_mcp",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("build_mcp_request", "invoke_mcp_capability")
builder.add_conditional_edges(
    "invoke_mcp_capability",
    route_after_invocation,
    {
        "integrate_result": "integrate_result",
        "select_capability": "select_capability",
        "mark_needs_review": "mark_needs_review",
        "answer_without_mcp": "answer_without_mcp",
    },
)
builder.add_conditional_edges(
    "integrate_result",
    route_after_integration,
    {
        "generate_final_response": "generate_final_response",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("answer_without_mcp", "generate_final_response")
builder.add_edge("mark_needs_review", "generate_final_response")
builder.add_edge("generate_final_response", END)

graph = builder.compile()
