from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_05_tool_use.nodes import (
    decide_next_action,
    execute_tool,
    handle_failure,
    handle_tool_error,
    normalize_model_decision,
    prepare_input,
    record_observation,
    request_confirmation,
    should_attempt_tool_error_recovery,
    synthesize_response,
    validate_tool_call,
)
from agentic_design_patterns.patterns.chapter_05_tool_use.state import ToolUseState


def route_after_prepare(
    state: ToolUseState,
) -> Literal["decide_next_action", "handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return "decide_next_action"


def route_after_normalize(
    state: ToolUseState,
) -> Literal["synthesize_response", "validate_tool_call", "handle_failure"]:
    if state.get("action") == "answer":
        return "synthesize_response"
    if state.get("action") == "tool_call" and state.get("pending_tool_call"):
        return "validate_tool_call"
    return "handle_failure"


def route_after_validation(
    state: ToolUseState,
) -> Literal["execute_tool", "request_confirmation", "handle_tool_error"]:
    if state.get("status") == "needs_confirmation":
        return "request_confirmation"
    if state.get("status") == "needs_tool" and not state.get("current_tool_error"):
        return "execute_tool"
    return "handle_tool_error"


def route_after_execution(
    state: ToolUseState,
) -> Literal["record_observation", "handle_tool_error"]:
    if state.get("current_tool_result") and not state.get("current_tool_error"):
        return "record_observation"
    return "handle_tool_error"


def route_after_tool_error(
    state: ToolUseState,
) -> Literal["decide_next_action", "synthesize_response"]:
    if should_attempt_tool_error_recovery(state):
        return "decide_next_action"
    return "synthesize_response"


builder = StateGraph(ToolUseState)
builder.add_node("prepare_input", prepare_input)
builder.add_node("decide_next_action", decide_next_action)
builder.add_node("normalize_model_decision", normalize_model_decision)
builder.add_node("validate_tool_call", validate_tool_call)
builder.add_node("execute_tool", execute_tool)
builder.add_node("record_observation", record_observation)
builder.add_node("synthesize_response", synthesize_response)
builder.add_node("request_confirmation", request_confirmation)
builder.add_node("handle_tool_error", handle_tool_error)
builder.add_node("handle_failure", handle_failure)

builder.add_edge(START, "prepare_input")
builder.add_conditional_edges(
    "prepare_input",
    route_after_prepare,
    {
        "decide_next_action": "decide_next_action",
        "handle_failure": "handle_failure",
    },
)
builder.add_edge("decide_next_action", "normalize_model_decision")
builder.add_conditional_edges(
    "normalize_model_decision",
    route_after_normalize,
    {
        "synthesize_response": "synthesize_response",
        "validate_tool_call": "validate_tool_call",
        "handle_failure": "handle_failure",
    },
)
builder.add_conditional_edges(
    "validate_tool_call",
    route_after_validation,
    {
        "execute_tool": "execute_tool",
        "request_confirmation": "request_confirmation",
        "handle_tool_error": "handle_tool_error",
    },
)
builder.add_conditional_edges(
    "execute_tool",
    route_after_execution,
    {
        "record_observation": "record_observation",
        "handle_tool_error": "handle_tool_error",
    },
)
builder.add_edge("record_observation", "decide_next_action")
builder.add_conditional_edges(
    "handle_tool_error",
    route_after_tool_error,
    {
        "decide_next_action": "decide_next_action",
        "synthesize_response": "synthesize_response",
    },
)
builder.add_edge("synthesize_response", END)
builder.add_edge("request_confirmation", END)
builder.add_edge("handle_failure", END)

graph = builder.compile()
