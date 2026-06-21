from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_06_planning.nodes import (
    assess_progress,
    create_plan,
    execute_step,
    mark_needs_review,
    prepare_input,
    repair_plan,
    replan,
    review_plan,
    select_next_step,
    synthesize_report,
    validate_plan,
)
from agentic_design_patterns.patterns.chapter_06_planning.state import PlanningState


def route_after_prepare(
    state: PlanningState,
) -> Literal["create_plan", "mark_needs_review"]:
    if state.get("status") == "failed":
        return "mark_needs_review"
    return "create_plan"


def route_after_validation(
    state: PlanningState,
) -> Literal["review_plan", "repair_plan", "mark_needs_review"]:
    if state.get("status") == "failed":
        return "mark_needs_review"
    if not state.get("plan_errors"):
        return "review_plan"
    if state.get("repair_count", 0) < state.get("max_repairs", 1):
        return "repair_plan"
    return "mark_needs_review"


def route_after_review(
    state: PlanningState,
) -> Literal["select_next_step", "mark_needs_review"]:
    if state.get("status") == "needs_review":
        return "mark_needs_review"
    return "select_next_step"


def route_after_select(
    state: PlanningState,
) -> Literal["execute_step", "synthesize_report", "mark_needs_review"]:
    if state.get("next_action") == "mark_needs_review":
        return "mark_needs_review"
    if state.get("current_step_id"):
        return "execute_step"
    return "synthesize_report"


def route_after_execute(
    state: PlanningState,
) -> Literal["assess_progress", "mark_needs_review"]:
    if state.get("status") == "needs_review":
        return "mark_needs_review"
    return "assess_progress"


def route_after_assessment(
    state: PlanningState,
) -> Literal[
    "select_next_step",
    "replan",
    "synthesize_report",
    "mark_needs_review",
]:
    next_action = state.get("next_action")
    if next_action == "replan":
        return "replan"
    if next_action == "synthesize_report":
        return "synthesize_report"
    if next_action == "mark_needs_review":
        return "mark_needs_review"
    return "select_next_step"


builder = StateGraph(PlanningState)
builder.add_node("prepare_input", prepare_input)
builder.add_node("create_plan", create_plan)
builder.add_node("validate_plan", validate_plan)
builder.add_node("repair_plan", repair_plan)
builder.add_node("review_plan", review_plan)
builder.add_node("select_next_step", select_next_step)
builder.add_node("execute_step", execute_step)
builder.add_node("assess_progress", assess_progress)
builder.add_node("replan", replan)
builder.add_node("synthesize_report", synthesize_report)
builder.add_node("mark_needs_review", mark_needs_review)

builder.add_edge(START, "prepare_input")
builder.add_conditional_edges(
    "prepare_input",
    route_after_prepare,
    {
        "create_plan": "create_plan",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("create_plan", "validate_plan")
builder.add_edge("repair_plan", "validate_plan")
builder.add_edge("replan", "validate_plan")
builder.add_conditional_edges(
    "validate_plan",
    route_after_validation,
    {
        "review_plan": "review_plan",
        "repair_plan": "repair_plan",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "review_plan",
    route_after_review,
    {
        "select_next_step": "select_next_step",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "select_next_step",
    route_after_select,
    {
        "execute_step": "execute_step",
        "synthesize_report": "synthesize_report",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "execute_step",
    route_after_execute,
    {
        "assess_progress": "assess_progress",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "assess_progress",
    route_after_assessment,
    {
        "select_next_step": "select_next_step",
        "replan": "replan",
        "synthesize_report": "synthesize_report",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("synthesize_report", END)
builder.add_edge("mark_needs_review", END)

graph = builder.compile()
