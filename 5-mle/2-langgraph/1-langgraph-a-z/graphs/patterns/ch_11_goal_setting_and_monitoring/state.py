from __future__ import annotations

from typing import Any, Literal, TypedDict


WorkflowStatus = Literal["ok", "needs_review", "failed"]
GoalStatus = Literal["met", "needs_revision", "needs_review", "failed"]
GoalVerdictStatus = Literal["met", "unmet", "uncertain"]
GoalPriority = Literal["required", "optional"]


class GoalContractItem(TypedDict, total=False):
    id: str
    description: str
    priority: GoalPriority
    acceptance_criteria: list[str]
    measurement: str


class GoalVerdict(TypedDict, total=False):
    goal_id: str
    status: GoalVerdictStatus
    evidence: str
    required: bool
    recoverable: bool


class ProgressEvent(TypedDict, total=False):
    node: str
    details: dict[str, Any]


class GoalMonitoringState(TypedDict, total=False):
    input: str
    use_case: str
    raw_goals: list[str]
    goal_contract: list[GoalContractItem]
    success_criteria: dict[str, Any]
    candidate_artifact: str | None
    previous_artifacts: list[str]
    check_results: dict[str, Any]
    monitoring_report: dict[str, Any]
    goal_status: GoalStatus
    revision_feedback: str | None
    iteration_count: int
    max_iterations: int
    progress_history: list[ProgressEvent]
    needs_human_review: bool
    errors: list[str]
    final_output: dict[str, Any] | None
    status: WorkflowStatus
    candidate_generator: Any
    objective_checker: Any
    candidate_monitor: Any
    metadata: dict[str, Any]
