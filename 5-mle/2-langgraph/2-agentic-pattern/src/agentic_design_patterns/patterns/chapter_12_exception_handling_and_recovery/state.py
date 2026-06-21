from __future__ import annotations

from typing import Any, Literal, TypedDict


ErrorCategory = Literal[
    "transient",
    "not_found",
    "invalid_input",
    "malformed_output",
    "service_unavailable",
    "severe",
]
RecoveryAction = Literal[
    "return_primary",
    "retry",
    "fallback",
    "degrade",
    "review",
    "fail",
]
WorkflowStatus = Literal["in_progress", "ok", "degraded", "needs_review", "failed"]


class ToolError(TypedDict, total=False):
    operation: str
    category: ErrorCategory
    message: str
    retryable: bool
    retry_count: int


class EventLogEntry(TypedDict, total=False):
    node: str
    event: str
    details: dict[str, Any]


class ExceptionRecoveryState(TypedDict, total=False):
    input: str
    normalized_query: str
    address: str | None
    city: str | None
    primary_result: dict[str, Any] | None
    fallback_result: dict[str, Any] | None
    location_result: dict[str, Any] | None
    primary_location_failed: bool
    fallback_location_failed: bool
    last_error: ToolError | None
    tool_errors: list[ToolError]
    event_log: list[EventLogEntry]
    retry_count: int
    max_retries: int
    error_category: ErrorCategory | None
    recovery_action: RecoveryAction | None
    needs_human_review: bool
    final_output: dict[str, Any] | None
    status: WorkflowStatus
    primary_lookup_tool: Any
    fallback_lookup_tool: Any
