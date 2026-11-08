from __future__ import annotations

from typing import Any, Literal, TypedDict


ReasoningStatus = Literal[
    "ok",
    "partial",
    "insufficient_evidence",
    "tool_error",
    "invalid_input",
]
ReasoningDepth = Literal["minimal", "standard", "deep"]
ActionType = Literal["retrieve", "compute", "synthesize"]


class ReasoningBudget(TypedDict, total=False):
    branches: int
    reflection_rounds: int
    retrieval_calls: int
    computation_calls: int


class ReasoningUsage(TypedDict, total=False):
    branches: int
    reflection_rounds: int
    retrieval_calls: int
    computation_calls: int
    model_calls: int


class ReasoningSubquestion(TypedDict, total=False):
    id: str
    question: str
    topic: str
    needs_evidence: bool
    needs_computation: bool
    resolved: bool


class ReasoningBranch(TypedDict, total=False):
    id: str
    strategy: str
    focus: str
    subquestion_ids: list[str]


class ReasoningAction(TypedDict, total=False):
    type: ActionType
    subquestion_id: str
    query: str
    expression: str
    reason: str


class ReasoningObservation(TypedDict, total=False):
    type: str
    subquestion_id: str
    status: str
    query: str
    result: Any
    message: str


class ReasoningTechniquesState(TypedDict, total=False):
    input: str
    normalized_input: str
    reasoning_depth: ReasoningDepth
    reasoning_budget: ReasoningBudget
    budget_used: ReasoningUsage
    subquestions: list[ReasoningSubquestion]
    candidate_branches: list[ReasoningBranch]
    selected_branch_id: str | None
    action_plan: list[ReasoningAction]
    next_action: ReasoningAction | None
    observations: list[ReasoningObservation]
    supporting_evidence: list[dict[str, Any]]
    contradictions: list[dict[str, Any]]
    knowledge_gaps: list[str]
    computation_requests: list[dict[str, Any]]
    computation_results: list[dict[str, Any]]
    draft_answer: str | None
    critique: dict[str, Any] | None
    revised_answer: str | None
    reasoning_summary: str | None
    answer_ready: bool
    budget_exhausted: bool
    status: ReasoningStatus
    errors: list[str]
    final_output: dict[str, Any] | None
    knowledge_base: list[dict[str, Any]]
    retriever: Any
    computation_tool: Any
    allow_computation: bool
    classification: dict[str, Any]

