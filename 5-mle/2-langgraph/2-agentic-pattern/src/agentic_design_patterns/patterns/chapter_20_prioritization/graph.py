from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_20_prioritization.nodes import (
    analyze_dependencies,
    assign_selected_tasks,
    check_resource_fit,
    decide_reprioritization,
    evaluate_task_criteria,
    finalize_priority_plan,
    ingest_tasks,
    normalize_tasks,
    prepare_prioritization_context,
    rank_tasks,
    request_human_review,
)
from agentic_design_patterns.patterns.chapter_20_prioritization.state import PrioritizationState


def route_after_prepare(
    state: PrioritizationState,
) -> Literal["ingest_tasks", "finalize_priority_plan"]:
    if state.get("status") == "empty":
        return "finalize_priority_plan"
    return "ingest_tasks"


def route_after_normalize(
    state: PrioritizationState,
) -> Literal["evaluate_task_criteria", "request_human_review"]:
    if state.get("status") == "needs_review" or state.get("errors"):
        return "request_human_review"
    return "evaluate_task_criteria"


def route_after_dependencies(
    state: PrioritizationState,
) -> Literal["check_resource_fit", "request_human_review"]:
    if state.get("status") == "needs_review" and state.get("errors"):
        return "request_human_review"
    return "check_resource_fit"


def route_after_reprioritization(
    state: PrioritizationState,
) -> Literal["evaluate_task_criteria", "assign_selected_tasks"]:
    ranked_ids = {task.get("id") for task in state.get("ranked_tasks", [])}
    if (
        state.get("reprioritization_reason")
        and state.get("reprioritization_passes", 0) == 1
        and "TASK-CRITICAL" not in ranked_ids
    ):
        return "evaluate_task_criteria"
    return "assign_selected_tasks"


def route_after_assignment(
    state: PrioritizationState,
) -> Literal["request_human_review", "finalize_priority_plan"]:
    if state.get("needs_review"):
        return "request_human_review"
    return "finalize_priority_plan"


builder = StateGraph(PrioritizationState)
builder.add_node("prepare_prioritization_context", prepare_prioritization_context)
builder.add_node("ingest_tasks", ingest_tasks)
builder.add_node("normalize_tasks", normalize_tasks)
builder.add_node("evaluate_task_criteria", evaluate_task_criteria)
builder.add_node("analyze_dependencies", analyze_dependencies)
builder.add_node("check_resource_fit", check_resource_fit)
builder.add_node("rank_tasks", rank_tasks)
builder.add_node("decide_reprioritization", decide_reprioritization)
builder.add_node("assign_selected_tasks", assign_selected_tasks)
builder.add_node("request_human_review", request_human_review)
builder.add_node("finalize_priority_plan", finalize_priority_plan)

builder.add_edge(START, "prepare_prioritization_context")
builder.add_conditional_edges(
    "prepare_prioritization_context",
    route_after_prepare,
    {
        "ingest_tasks": "ingest_tasks",
        "finalize_priority_plan": "finalize_priority_plan",
    },
)
builder.add_edge("ingest_tasks", "normalize_tasks")
builder.add_conditional_edges(
    "normalize_tasks",
    route_after_normalize,
    {
        "evaluate_task_criteria": "evaluate_task_criteria",
        "request_human_review": "request_human_review",
    },
)
builder.add_edge("evaluate_task_criteria", "analyze_dependencies")
builder.add_conditional_edges(
    "analyze_dependencies",
    route_after_dependencies,
    {
        "check_resource_fit": "check_resource_fit",
        "request_human_review": "request_human_review",
    },
)
builder.add_edge("check_resource_fit", "rank_tasks")
builder.add_edge("rank_tasks", "decide_reprioritization")
builder.add_conditional_edges(
    "decide_reprioritization",
    route_after_reprioritization,
    {
        "evaluate_task_criteria": "evaluate_task_criteria",
        "assign_selected_tasks": "assign_selected_tasks",
    },
)
builder.add_conditional_edges(
    "assign_selected_tasks",
    route_after_assignment,
    {
        "request_human_review": "request_human_review",
        "finalize_priority_plan": "finalize_priority_plan",
    },
)
builder.add_edge("request_human_review", "finalize_priority_plan")
builder.add_edge("finalize_priority_plan", END)

graph = builder.compile()
