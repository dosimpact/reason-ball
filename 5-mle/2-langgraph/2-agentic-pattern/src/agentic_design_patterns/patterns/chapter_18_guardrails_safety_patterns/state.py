from __future__ import annotations

from typing import Any, Literal, TypedDict


PolicyStatus = Literal["safe", "unsafe", "review"]
FinalStatus = Literal[
    "answered",
    "blocked",
    "tool_blocked",
    "repaired",
    "needs_review",
    "error",
]


class PolicyDecision(TypedDict, total=False):
    decision: PolicyStatus
    summary: str
    triggered_policies: list[str]
    confidence: float
    recoverable: bool


class ToolCall(TypedDict, total=False):
    name: str
    arguments: dict[str, Any]


class GuardrailsSafetyState(TypedDict, total=False):
    input: str
    normalized_input: str
    session_user_id: str | None
    policy_config: dict[str, Any]
    system_constraints: list[str]
    allowed_tools: list[str]
    tool_scopes: dict[str, Any]
    input_policy_decision: PolicyDecision | dict[str, Any] | None
    is_input_allowed: bool
    primary_response: str | None
    requested_tool_call: ToolCall | dict[str, Any] | None
    tool_policy_decision: PolicyDecision | dict[str, Any] | None
    tool_result: dict[str, Any] | None
    output_policy_decision: PolicyDecision | dict[str, Any] | None
    repair_attempts: int
    needs_human_review: bool
    human_review_result: dict[str, Any] | None
    audit_events: list[dict[str, Any]]
    errors: list[str]
    final_output: dict[str, Any] | None
    status: FinalStatus | None

