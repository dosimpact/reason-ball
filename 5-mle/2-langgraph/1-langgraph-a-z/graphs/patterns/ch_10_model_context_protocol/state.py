from __future__ import annotations

from typing import Any, Literal, TypedDict


MCPIntent = Literal[
    "read_resource",
    "execute_tool",
    "use_prompt",
    "answer_without_mcp",
]
MCPOperationType = Literal["resource", "tool", "prompt", "none"]
MCPStatus = Literal["ok", "fallback", "needs_review", "failed"]


class MCPState(TypedDict, total=False):
    input: str
    normalized_input: str
    intent: MCPIntent | None
    operation_type: MCPOperationType | None
    server_preferences: list[str]
    capability_manifest: dict[str, Any]
    candidate_capabilities: list[dict[str, Any]]
    selected_capability: dict[str, Any] | None
    rejected_capabilities: list[str]
    capability_validation: dict[str, Any]
    mcp_request: dict[str, Any] | None
    mcp_result: dict[str, Any] | None
    context_update: dict[str, Any] | None
    fallback_reason: str | None
    needs_human_review: bool
    errors: list[str]
    invocation_attempts: int
    max_invocation_attempts: int
    status: MCPStatus
    final_output: dict[str, Any] | None
    metadata: dict[str, Any]
    mcp_client: Any
    response_generator: Any
