from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_04_reflection.nodes import (
    critique_draft,
    finalize,
    generate_initial_draft,
    handle_failure,
    mark_needs_review,
    prepare_task,
    refine_draft,
)
from agentic_design_patterns.patterns.chapter_04_reflection.state import ReflectionState


def route_after_prepare(
    state: ReflectionState,
) -> Literal["generate_initial_draft", "handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return "generate_initial_draft"


def route_after_draft(
    state: ReflectionState,
) -> Literal["critique_draft", "mark_needs_review", "handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    if state.get("critique_status") == "invalid":
        return "mark_needs_review"
    return "critique_draft"


def route_after_critique(
    state: ReflectionState,
) -> Literal["finalize", "refine_draft", "mark_needs_review"]:
    if state.get("critique_status") == "accepted":
        return "finalize"

    if (
        state.get("critique_status") == "needs_revision"
        and state.get("iteration", 0) < state.get("max_iterations", 1)
    ):
        return "refine_draft"

    return "mark_needs_review"


builder = StateGraph(ReflectionState)
builder.add_node("prepare_task", prepare_task)
builder.add_node("generate_initial_draft", generate_initial_draft)
builder.add_node("critique_draft", critique_draft)
builder.add_node("refine_draft", refine_draft)
builder.add_node("finalize", finalize)
builder.add_node("mark_needs_review", mark_needs_review)
builder.add_node("handle_failure", handle_failure)

builder.add_edge(START, "prepare_task")
builder.add_conditional_edges(
    "prepare_task",
    route_after_prepare,
    {
        "generate_initial_draft": "generate_initial_draft",
        "handle_failure": "handle_failure",
    },
)
builder.add_conditional_edges(
    "generate_initial_draft",
    route_after_draft,
    {
        "critique_draft": "critique_draft",
        "mark_needs_review": "mark_needs_review",
        "handle_failure": "handle_failure",
    },
)
builder.add_conditional_edges(
    "critique_draft",
    route_after_critique,
    {
        "finalize": "finalize",
        "refine_draft": "refine_draft",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "refine_draft",
    route_after_draft,
    {
        "critique_draft": "critique_draft",
        "mark_needs_review": "mark_needs_review",
        "handle_failure": "handle_failure",
    },
)
builder.add_edge("finalize", END)
builder.add_edge("mark_needs_review", END)
builder.add_edge("handle_failure", END)

graph = builder.compile()
