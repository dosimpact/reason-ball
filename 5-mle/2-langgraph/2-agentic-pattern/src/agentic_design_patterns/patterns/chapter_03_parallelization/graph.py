from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_03_parallelization.nodes import (
    collect_branch_outputs,
    extract_key_terms,
    fan_out_branches,
    generate_questions,
    handle_failure,
    initialize,
    summarize_topic,
    synthesize_answer,
)
from agentic_design_patterns.patterns.chapter_03_parallelization.state import (
    ParallelizationState,
)


def route_after_initialize(
    state: ParallelizationState,
) -> Literal["fan_out_branches", "handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return "fan_out_branches"


def route_after_synthesis(
    state: ParallelizationState,
) -> Literal["handle_failure", "__end__"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return END


builder = StateGraph(ParallelizationState)
builder.add_node("initialize", initialize)
builder.add_node("fan_out_branches", fan_out_branches)
builder.add_node("summarize_topic", summarize_topic)
builder.add_node("generate_questions", generate_questions)
builder.add_node("extract_key_terms", extract_key_terms)
builder.add_node("collect_branch_outputs", collect_branch_outputs)
builder.add_node("synthesize_answer", synthesize_answer)
builder.add_node("handle_failure", handle_failure)

builder.add_edge(START, "initialize")
builder.add_conditional_edges(
    "initialize",
    route_after_initialize,
    {
        "fan_out_branches": "fan_out_branches",
        "handle_failure": "handle_failure",
    },
)
builder.add_edge("fan_out_branches", "summarize_topic")
builder.add_edge("fan_out_branches", "generate_questions")
builder.add_edge("fan_out_branches", "extract_key_terms")
builder.add_edge("summarize_topic", "collect_branch_outputs")
builder.add_edge("generate_questions", "collect_branch_outputs")
builder.add_edge("extract_key_terms", "collect_branch_outputs")
builder.add_edge("collect_branch_outputs", "synthesize_answer")
builder.add_conditional_edges(
    "synthesize_answer",
    route_after_synthesis,
    {
        "handle_failure": "handle_failure",
        END: END,
    },
)
builder.add_edge("handle_failure", END)

graph = builder.compile()
