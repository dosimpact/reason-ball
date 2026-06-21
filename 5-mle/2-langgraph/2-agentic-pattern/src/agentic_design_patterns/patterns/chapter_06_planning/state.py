from __future__ import annotations

from typing import Any, Literal, TypedDict


WorkflowStatus = Literal["ok", "needs_review", "failed"]
StepStatus = Literal["pending", "complete", "blocked", "skipped"]
StepResultStatus = Literal["complete", "blocked", "failed"]
NextAction = Literal[
    "select_next_step",
    "replan",
    "synthesize_report",
    "mark_needs_review",
]


class SourceNote(TypedDict, total=False):
    source_id: str
    title: str
    text: str
    summary: str


class PlanStep(TypedDict, total=False):
    id: str
    description: str
    depends_on: list[str]
    tool: str
    acceptance_criteria: list[str]
    status: StepStatus
    required: bool


class StepResult(TypedDict, total=False):
    step_id: str
    status: StepResultStatus
    summary: str
    evidence: list[dict[str, Any]]
    gaps: list[str]
    error: str | None


class ExecutionEvent(TypedDict, total=False):
    node: str
    details: dict[str, Any]


class PlanningState(TypedDict, total=False):
    input: str
    goal: str
    constraints: dict[str, Any]
    source_notes: list[SourceNote]
    raw_plan_output: str
    raw_replan_output: str
    plan: list[PlanStep]
    plan_errors: list[str]
    approved_plan: bool
    current_step_id: str | None
    step_results: dict[str, StepResult]
    observations: list[str]
    knowledge_gaps: list[str]
    execution_history: list[ExecutionEvent]
    repair_count: int
    max_repairs: int
    replan_count: int
    max_replans: int
    max_steps: int
    blocked_reason: str | None
    next_action: NextAction
    final_report: str
    status: WorkflowStatus
    final_output: dict[str, Any]
