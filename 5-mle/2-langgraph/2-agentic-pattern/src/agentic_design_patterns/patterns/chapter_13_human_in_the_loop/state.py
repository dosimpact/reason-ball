from __future__ import annotations

from typing import Any, Literal, TypedDict


WorkflowStatus = Literal["ok", "awaiting_human", "review_unavailable", "failed"]
IssueType = Literal[
    "software",
    "hardware",
    "billing",
    "account",
    "safety",
    "unknown",
]
Sentiment = Literal["neutral", "frustrated", "angry", "distressed"]
RiskLevel = Literal["low", "medium", "high", "critical"]
AmbiguityLevel = Literal["low", "medium", "high"]
ReviewStatus = Literal[
    "not_required",
    "requested",
    "approved",
    "edited",
    "rejected",
    "escalated",
    "more_info_requested",
    "review_unavailable",
]


class HumanInTheLoopState(TypedDict, total=False):
    input: str
    customer_id: str | None
    customer_info: dict[str, Any]
    support_history: list[dict[str, Any]]
    customer_contexts: dict[str, dict[str, Any]]
    normalized_input: str
    issue_type: IssueType | None
    sentiment: Sentiment | None
    risk_level: RiskLevel
    ambiguity_level: AmbiguityLevel
    escalation_policy: dict[str, Any]
    agent_recommendation: dict[str, Any] | None
    troubleshooting_result: dict[str, Any] | None
    ticket: dict[str, Any] | None
    needs_human_review: bool
    escalation_reason: str | None
    review_request: dict[str, Any] | None
    redacted_review_request: dict[str, Any] | None
    review_interrupt: dict[str, Any] | None
    human_response: dict[str, Any] | None
    human_feedback: dict[str, Any] | None
    review_status: ReviewStatus
    errors: list[str]
    final_answer: str | None
    final_output: dict[str, Any] | None
    status: WorkflowStatus
    metadata: dict[str, Any]
    human_review_provider: Any
