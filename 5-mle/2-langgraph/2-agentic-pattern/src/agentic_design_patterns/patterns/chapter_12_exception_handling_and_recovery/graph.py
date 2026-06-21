from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_12_exception_handling_and_recovery.nodes import (
    call_general_area_lookup,
    call_precise_lookup,
    diagnose_failure,
    finalize_response,
    mark_for_review,
    parse_location_query,
    prepare_request,
    retry_precise_lookup,
    select_recovered_result,
)
from agentic_design_patterns.patterns.chapter_12_exception_handling_and_recovery.state import (
    ExceptionRecoveryState,
)


def route_after_prepare(
    state: ExceptionRecoveryState,
) -> Literal["parse_location_query", "mark_for_review"]:
    if state.get("recovery_action") == "review":
        return "mark_for_review"
    return "parse_location_query"


def route_after_diagnosis(
    state: ExceptionRecoveryState,
) -> Literal[
    "select_recovered_result",
    "retry_precise_lookup",
    "call_general_area_lookup",
    "mark_for_review",
]:
    action = state.get("recovery_action")
    if action == "return_primary":
        return "select_recovered_result"
    if action == "retry":
        return "retry_precise_lookup"
    if action == "fallback":
        return "call_general_area_lookup"
    return "mark_for_review"


builder = StateGraph(ExceptionRecoveryState)
builder.add_node("prepare_request", prepare_request)
builder.add_node("parse_location_query", parse_location_query)
builder.add_node("call_precise_lookup", call_precise_lookup)
builder.add_node("diagnose_failure", diagnose_failure)
builder.add_node("retry_precise_lookup", retry_precise_lookup)
builder.add_node("call_general_area_lookup", call_general_area_lookup)
builder.add_node("select_recovered_result", select_recovered_result)
builder.add_node("mark_for_review", mark_for_review)
builder.add_node("finalize_response", finalize_response)

builder.add_edge(START, "prepare_request")
builder.add_conditional_edges(
    "prepare_request",
    route_after_prepare,
    {
        "parse_location_query": "parse_location_query",
        "mark_for_review": "mark_for_review",
    },
)
builder.add_edge("parse_location_query", "call_precise_lookup")
builder.add_edge("call_precise_lookup", "diagnose_failure")
builder.add_conditional_edges(
    "diagnose_failure",
    route_after_diagnosis,
    {
        "select_recovered_result": "select_recovered_result",
        "retry_precise_lookup": "retry_precise_lookup",
        "call_general_area_lookup": "call_general_area_lookup",
        "mark_for_review": "mark_for_review",
    },
)
builder.add_edge("retry_precise_lookup", "call_precise_lookup")
builder.add_edge("call_general_area_lookup", "select_recovered_result")
builder.add_edge("select_recovered_result", "finalize_response")
builder.add_edge("mark_for_review", "finalize_response")
builder.add_edge("finalize_response", END)

graph = builder.compile()
