from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_07_multi_agent.nodes import (
    analysis_agent,
    finalize,
    handle_failure,
    mark_needs_human_review,
    prepare_objective,
    research_agent,
    revise_draft,
    reviewer_agent,
    supervisor_plan,
    synthesize_context,
    validate_team_plan,
    writer_agent,
)
from agentic_design_patterns.patterns.chapter_07_multi_agent.state import (
    MultiAgentState,
)


def route_after_prepare(
    state: MultiAgentState,
) -> Literal["supervisor_plan", "handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return "supervisor_plan"


def route_after_validate(
    state: MultiAgentState,
) -> list[str] | Literal["handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return ["research_agent", "analysis_agent"]


def route_after_synthesis(
    state: MultiAgentState,
) -> Literal["writer_agent", "mark_needs_human_review"]:
    if state.get("status") == "needs_human_review":
        return "mark_needs_human_review"
    return "writer_agent"


def route_after_writer(
    state: MultiAgentState,
) -> Literal["reviewer_agent", "mark_needs_human_review"]:
    if state.get("status") == "needs_human_review" or not state.get("draft_report"):
        return "mark_needs_human_review"
    return "reviewer_agent"


def route_after_review(
    state: MultiAgentState,
) -> Literal["finalize", "revise_draft", "mark_needs_human_review"]:
    review_result = state.get("review_result") or {}
    if review_result.get("approved") and not state.get("requires_human_review"):
        return "finalize"
    if (
        state.get("status") == "needs_revision"
        and state.get("retry_count", 0) < state.get("max_retries", 1)
    ):
        return "revise_draft"
    return "mark_needs_human_review"


def route_after_revision(
    state: MultiAgentState,
) -> Literal["reviewer_agent", "mark_needs_human_review"]:
    if state.get("status") == "needs_human_review" or not state.get("draft_report"):
        return "mark_needs_human_review"
    return "reviewer_agent"


builder = StateGraph(MultiAgentState)
builder.add_node("prepare_objective", prepare_objective)
builder.add_node("supervisor_plan", supervisor_plan)
builder.add_node("validate_team_plan", validate_team_plan)
builder.add_node("research_agent", research_agent)
builder.add_node("analysis_agent", analysis_agent)
builder.add_node("synthesize_context", synthesize_context)
builder.add_node("writer_agent", writer_agent)
builder.add_node("reviewer_agent", reviewer_agent)
builder.add_node("revise_draft", revise_draft)
builder.add_node("finalize", finalize)
builder.add_node("mark_needs_human_review", mark_needs_human_review)
builder.add_node("handle_failure", handle_failure)

builder.add_edge(START, "prepare_objective")
builder.add_conditional_edges(
    "prepare_objective",
    route_after_prepare,
    {
        "supervisor_plan": "supervisor_plan",
        "handle_failure": "handle_failure",
    },
)
builder.add_edge("supervisor_plan", "validate_team_plan")
builder.add_conditional_edges(
    "validate_team_plan",
    route_after_validate,
    [
        "research_agent",
        "analysis_agent",
        "handle_failure",
    ],
)
builder.add_edge(["research_agent", "analysis_agent"], "synthesize_context")
builder.add_conditional_edges(
    "synthesize_context",
    route_after_synthesis,
    {
        "writer_agent": "writer_agent",
        "mark_needs_human_review": "mark_needs_human_review",
    },
)
builder.add_conditional_edges(
    "writer_agent",
    route_after_writer,
    {
        "reviewer_agent": "reviewer_agent",
        "mark_needs_human_review": "mark_needs_human_review",
    },
)
builder.add_conditional_edges(
    "reviewer_agent",
    route_after_review,
    {
        "finalize": "finalize",
        "revise_draft": "revise_draft",
        "mark_needs_human_review": "mark_needs_human_review",
    },
)
builder.add_conditional_edges(
    "revise_draft",
    route_after_revision,
    {
        "reviewer_agent": "reviewer_agent",
        "mark_needs_human_review": "mark_needs_human_review",
    },
)
builder.add_edge("finalize", END)
builder.add_edge("mark_needs_human_review", END)
builder.add_edge("handle_failure", END)

graph = builder.compile()
