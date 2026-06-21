from __future__ import annotations

from typing import Any, Literal, TypedDict


PriorityLabel = Literal["P0", "P1", "P2"]
PrioritizationStatus = Literal["ok", "empty", "needs_review", "failed"]


class PrioritizedTask(TypedDict, total=False):
    id: str
    description: str
    priority: PriorityLabel
    assigned_to: str | None
    status: str
    deadline: str | None
    dependencies: list[str]
    required_skills: list[str]
    required_resources: list[str]
    importance: float
    effort: float
    created_order: int
    score: float
    executable: bool
    blocked_reason: str | None
    rationale: list[str]


class TaskEvaluation(TypedDict, total=False):
    urgency: float
    importance: float
    dependency_impact: float
    resource_fit: float
    cost_benefit: float
    user_preference: float
    total_score: float
    signals: list[str]


class PrioritizationState(TypedDict, total=False):
    input: str
    existing_tasks: list[dict[str, Any]]
    new_task_requests: list[str]
    tasks: list[PrioritizedTask]
    workers: list[dict[str, Any]]
    criteria_weights: dict[str, float]
    priority_policy: dict[str, Any]
    environment_context: dict[str, Any]
    task_evaluations: dict[str, TaskEvaluation]
    dependency_graph: dict[str, list[str]]
    blocked_tasks: list[dict[str, Any]]
    resource_fit: dict[str, dict[str, Any]]
    ranked_tasks: list[PrioritizedTask]
    selected_next_actions: list[dict[str, Any]]
    assignments: list[dict[str, Any]]
    reprioritization_reason: str | None
    reprioritization_passes: int
    needs_review: bool
    warnings: list[str]
    errors: list[str]
    priority_plan: dict[str, Any] | None
    final_response: str | None
    status: PrioritizationStatus

