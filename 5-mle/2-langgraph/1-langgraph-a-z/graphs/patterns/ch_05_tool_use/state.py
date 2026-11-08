from __future__ import annotations

from typing import Any, Literal, TypedDict


ToolUseAction = Literal["answer", "tool_call", "failure"]
ToolUseStatus = Literal[
    "ok",
    "needs_tool",
    "needs_confirmation",
    "needs_review",
    "failed",
]


class ToolCall(TypedDict, total=False):
    name: str
    arguments: dict[str, Any]


class ToolResult(TypedDict):
    name: str
    arguments: dict[str, Any]
    result: Any
    status: Literal["ok"]


class ToolError(TypedDict, total=False):
    name: str | None
    arguments: dict[str, Any]
    message: str
    error_type: str
    status: Literal["error"]
    attempted: bool


class ToolUseState(TypedDict, total=False):
    input: str
    normalized_input: str
    messages: list[dict[str, Any]]
    available_tools: list[str]
    raw_model_decision: dict[str, Any] | str | None
    action: ToolUseAction | None
    pending_tool_call: ToolCall | None
    current_tool_result: ToolResult | None
    current_tool_error: ToolError | None
    direct_answer: str | None
    tool_results: list[ToolResult]
    tool_errors: list[ToolError]
    tool_call_count: int
    max_tool_calls: int
    requires_confirmation: bool
    requires_human_review: bool
    status: ToolUseStatus
    final_output: str | None
    failure_reason: str | None
    metadata: dict[str, Any]
