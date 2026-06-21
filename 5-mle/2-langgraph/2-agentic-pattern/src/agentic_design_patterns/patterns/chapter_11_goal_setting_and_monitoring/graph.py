from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_11_goal_setting_and_monitoring.nodes import (
    define_goal_contract,
    finalize,
    generate_candidate,
    mark_needs_review,
    monitor_candidate,
    prepare_input,
    revise_candidate,
    run_objective_checks,
    validate_goal_contract,
)
from agentic_design_patterns.patterns.chapter_11_goal_setting_and_monitoring.state import (
    GoalMonitoringState,
)


def route_after_prepare(
    state: GoalMonitoringState,
) -> Literal["define_goal_contract", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "define_goal_contract"


def route_after_goal_validation(
    state: GoalMonitoringState,
) -> Literal["generate_candidate", "mark_needs_review"]:
    if state.get("needs_human_review") or state.get("goal_status") in {
        "needs_review",
        "failed",
    }:
        return "mark_needs_review"
    return "generate_candidate"


def route_after_generation(
    state: GoalMonitoringState,
) -> Literal["run_objective_checks", "mark_needs_review"]:
    if state.get("status") == "failed" or state.get("goal_status") == "failed":
        return "mark_needs_review"
    return "run_objective_checks"


def route_after_monitoring(
    state: GoalMonitoringState,
) -> Literal["finalize", "revise_candidate", "mark_needs_review"]:
    if state.get("goal_status") == "met":
        return "finalize"
    if (
        state.get("goal_status") == "needs_revision"
        and state.get("iteration_count", 0) < state.get("max_iterations", 1)
    ):
        return "revise_candidate"
    return "mark_needs_review"


builder = StateGraph(GoalMonitoringState)
builder.add_node("prepare_input", prepare_input)
builder.add_node("define_goal_contract", define_goal_contract)
builder.add_node("validate_goal_contract", validate_goal_contract)
builder.add_node("generate_candidate", generate_candidate)
builder.add_node("run_objective_checks", run_objective_checks)
builder.add_node("monitor_candidate", monitor_candidate)
builder.add_node("revise_candidate", revise_candidate)
builder.add_node("mark_needs_review", mark_needs_review)
builder.add_node("finalize", finalize)

builder.add_edge(START, "prepare_input")
builder.add_conditional_edges(
    "prepare_input",
    route_after_prepare,
    {
        "define_goal_contract": "define_goal_contract",
        "finalize": "finalize",
    },
)
builder.add_edge("define_goal_contract", "validate_goal_contract")
builder.add_conditional_edges(
    "validate_goal_contract",
    route_after_goal_validation,
    {
        "generate_candidate": "generate_candidate",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "generate_candidate",
    route_after_generation,
    {
        "run_objective_checks": "run_objective_checks",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "revise_candidate",
    route_after_generation,
    {
        "run_objective_checks": "run_objective_checks",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("run_objective_checks", "monitor_candidate")
builder.add_conditional_edges(
    "monitor_candidate",
    route_after_monitoring,
    {
        "finalize": "finalize",
        "revise_candidate": "revise_candidate",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("mark_needs_review", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
