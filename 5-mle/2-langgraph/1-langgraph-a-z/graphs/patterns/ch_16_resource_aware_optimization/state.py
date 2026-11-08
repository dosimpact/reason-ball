from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal, TypedDict


Classification = Literal[
    "simple",
    "reasoning",
    "current_info",
    "tool_required",
    "unsupported",
    "unknown",
]
ModelTier = Literal["fast", "reasoning", "grounded", "fallback"]
FinalStatus = Literal[
    "answered",
    "degraded",
    "unsupported",
    "budget_exhausted",
    "fallback_exhausted",
    "failed",
]


class ResourcePath(TypedDict, total=False):
    id: str
    model_tier: ModelTier
    model: str
    tools: list[str]
    estimated_cost_usd: float
    tokens: int
    time_ms: int
    tool_calls: int
    expected_quality: float
    available: bool
    reason: str


class ResourceTraceEvent(TypedDict, total=False):
    step: str
    event: str
    detail: str
    metadata: dict[str, Any]


class ResourceAwareOptimizationState(TypedDict, total=False):
    input: str
    context: list[dict[str, Any]]
    compressed_context: str | None
    resource_limits: dict[str, Any]
    resource_budget: dict[str, float]
    resource_usage: dict[str, float]
    deadline_ms: int | None
    allowed_capabilities: list[str]
    classification: Classification | None
    complexity_score: float | None
    freshness_required: bool
    quality_target: str
    candidate_paths: list[ResourcePath]
    selected_path: ResourcePath | None
    selected_model: str | None
    model_tier: ModelTier | None
    selected_tools: list[str]
    search_results: list[dict[str, Any]]
    model_response: str | None
    quality_score: float | None
    critique: dict[str, Any] | None
    routing_feedback: dict[str, Any] | None
    fallback_chain: list[str]
    fallback_used: bool
    degradation_reason: str | None
    errors: list[str]
    routing_trace: list[ResourceTraceEvent]
    final_output: dict[str, Any] | None
    retry_count: int
    max_retries: int
    status: FinalStatus | None
    search_tool: Callable[[str], list[dict[str, Any]]]

