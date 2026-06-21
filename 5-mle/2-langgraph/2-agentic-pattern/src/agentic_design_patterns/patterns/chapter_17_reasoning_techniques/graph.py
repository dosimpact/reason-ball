from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_17_reasoning_techniques.nodes import (
    classify_reasoning_need,
    decompose_question,
    execute_computation,
    finalize_response,
    generate_reasoning_branches,
    prepare_question,
    record_observation,
    reflect_on_progress,
    retrieve_evidence,
    select_next_action,
    self_correct_answer,
    synthesize_answer,
)
from agentic_design_patterns.patterns.chapter_17_reasoning_techniques.state import (
    ReasoningTechniquesState,
)


def route_after_prepare(
    state: ReasoningTechniquesState,
) -> Literal["classify_reasoning_need", "finalize_response"]:
    if state.get("status") == "invalid_input":
        return "finalize_response"
    return "classify_reasoning_need"


def route_after_classification(
    state: ReasoningTechniquesState,
) -> Literal["decompose_question", "synthesize_answer"]:
    classification = state.get("classification", {})
    if classification.get("simple"):
        return "synthesize_answer"
    return "decompose_question"


def route_after_action_selection(
    state: ReasoningTechniquesState,
) -> Literal["retrieve_evidence", "execute_computation", "synthesize_answer"]:
    action_type = (state.get("next_action") or {}).get("type")
    if action_type == "retrieve":
        return "retrieve_evidence"
    if action_type == "compute":
        return "execute_computation"
    return "synthesize_answer"


def route_after_reflection(
    state: ReasoningTechniquesState,
) -> Literal["select_next_action", "synthesize_answer", "finalize_response"]:
    if state.get("answer_ready"):
        return "synthesize_answer"
    if state.get("budget_exhausted"):
        return "finalize_response"
    return "select_next_action"


builder = StateGraph(ReasoningTechniquesState)
builder.add_node("prepare_question", prepare_question)
builder.add_node("classify_reasoning_need", classify_reasoning_need)
builder.add_node("decompose_question", decompose_question)
builder.add_node("generate_reasoning_branches", generate_reasoning_branches)
builder.add_node("select_next_action", select_next_action)
builder.add_node("retrieve_evidence", retrieve_evidence)
builder.add_node("execute_computation", execute_computation)
builder.add_node("record_observation", record_observation)
builder.add_node("reflect_on_progress", reflect_on_progress)
builder.add_node("synthesize_answer", synthesize_answer)
builder.add_node("self_correct_answer", self_correct_answer)
builder.add_node("finalize_response", finalize_response)

builder.add_edge(START, "prepare_question")
builder.add_conditional_edges(
    "prepare_question",
    route_after_prepare,
    {
        "classify_reasoning_need": "classify_reasoning_need",
        "finalize_response": "finalize_response",
    },
)
builder.add_conditional_edges(
    "classify_reasoning_need",
    route_after_classification,
    {
        "decompose_question": "decompose_question",
        "synthesize_answer": "synthesize_answer",
    },
)
builder.add_edge("decompose_question", "generate_reasoning_branches")
builder.add_edge("generate_reasoning_branches", "select_next_action")
builder.add_conditional_edges(
    "select_next_action",
    route_after_action_selection,
    {
        "retrieve_evidence": "retrieve_evidence",
        "execute_computation": "execute_computation",
        "synthesize_answer": "synthesize_answer",
    },
)
builder.add_edge("retrieve_evidence", "record_observation")
builder.add_edge("execute_computation", "record_observation")
builder.add_edge("record_observation", "reflect_on_progress")
builder.add_conditional_edges(
    "reflect_on_progress",
    route_after_reflection,
    {
        "select_next_action": "select_next_action",
        "synthesize_answer": "synthesize_answer",
        "finalize_response": "finalize_response",
    },
)
builder.add_edge("synthesize_answer", "self_correct_answer")
builder.add_edge("self_correct_answer", "finalize_response")
builder.add_edge("finalize_response", END)

graph = builder.compile()

