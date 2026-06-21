from __future__ import annotations

from typing import Literal

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.store.memory import InMemoryStore

from agentic_design_patterns.patterns.chapter_08_memory_management.nodes import (
    build_prompt_context,
    build_retrieval_query,
    compact_short_term_memory,
    extract_memory_candidates,
    finalize,
    generate_response,
    mark_needs_review,
    prepare_turn,
    retrieve_long_term_memory,
    store_memory_updates,
    validate_memory_updates,
)
from agentic_design_patterns.patterns.chapter_08_memory_management.state import (
    MemoryManagementState,
)


def route_after_prepare(
    state: MemoryManagementState,
) -> Literal["build_retrieval_query", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "build_retrieval_query"


def route_after_retrieval(
    state: MemoryManagementState,
) -> Literal["compact_short_term_memory", "mark_needs_review"]:
    if state.get("status") == "needs_review":
        return "mark_needs_review"
    return "compact_short_term_memory"


def route_after_generation(
    state: MemoryManagementState,
) -> Literal["extract_memory_candidates", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "extract_memory_candidates"


def route_after_validation(
    state: MemoryManagementState,
) -> Literal["store_memory_updates", "finalize", "mark_needs_review"]:
    if state.get("status") == "needs_review":
        return "mark_needs_review"
    if state.get("approved_memory_updates"):
        return "store_memory_updates"
    return "finalize"


builder = StateGraph(MemoryManagementState)
builder.add_node("prepare_turn", prepare_turn)
builder.add_node("build_retrieval_query", build_retrieval_query)
builder.add_node("retrieve_long_term_memory", retrieve_long_term_memory)
builder.add_node("compact_short_term_memory", compact_short_term_memory)
builder.add_node("build_prompt_context", build_prompt_context)
builder.add_node("generate_response", generate_response)
builder.add_node("extract_memory_candidates", extract_memory_candidates)
builder.add_node("validate_memory_updates", validate_memory_updates)
builder.add_node("store_memory_updates", store_memory_updates)
builder.add_node("finalize", finalize)
builder.add_node("mark_needs_review", mark_needs_review)

builder.add_edge(START, "prepare_turn")
builder.add_conditional_edges(
    "prepare_turn",
    route_after_prepare,
    {
        "build_retrieval_query": "build_retrieval_query",
        "finalize": "finalize",
    },
)
builder.add_edge("build_retrieval_query", "retrieve_long_term_memory")
builder.add_conditional_edges(
    "retrieve_long_term_memory",
    route_after_retrieval,
    {
        "compact_short_term_memory": "compact_short_term_memory",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("compact_short_term_memory", "build_prompt_context")
builder.add_edge("build_prompt_context", "generate_response")
builder.add_conditional_edges(
    "generate_response",
    route_after_generation,
    {
        "extract_memory_candidates": "extract_memory_candidates",
        "finalize": "finalize",
    },
)
builder.add_edge("extract_memory_candidates", "validate_memory_updates")
builder.add_conditional_edges(
    "validate_memory_updates",
    route_after_validation,
    {
        "store_memory_updates": "store_memory_updates",
        "finalize": "finalize",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("store_memory_updates", "finalize")
builder.add_edge("finalize", END)
builder.add_edge("mark_needs_review", END)

graph = builder.compile()

test_graph = builder.compile(
    checkpointer=InMemorySaver(),
    store=InMemoryStore(),
)
