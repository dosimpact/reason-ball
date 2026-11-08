from __future__ import annotations

from typing import Any, Literal, TypedDict


EvaluationStatus = Literal["passed", "failed", "warning", "needs_review", "invalid"]
TrajectoryMatchMode = Literal[
    "exact",
    "in_order",
    "any_order",
    "precision_recall",
    "single_tool",
]


class EvaluationAlert(TypedDict, total=False):
    severity: str
    metric: str
    reason: str
    recommended_action: str


class EvaluationMonitoringState(TypedDict, total=False):
    input: str
    agent_run: dict[str, Any]
    actual_output: str
    reference_output: str | None
    actual_trajectory: list[dict[str, Any]]
    expected_trajectory: list[dict[str, Any]]
    trajectory_match_mode: TrajectoryMatchMode | str
    run_metadata: dict[str, Any]
    thresholds: dict[str, Any]
    rubric: dict[str, Any] | None
    baseline_metrics: dict[str, Any] | None
    response_metrics: dict[str, Any]
    operational_metrics: dict[str, Any]
    trajectory_metrics: dict[str, Any]
    judge_result: dict[str, Any] | None
    audit_findings: list[dict[str, Any]]
    drift_signals: dict[str, Any]
    alerts: list[EvaluationAlert]
    evaluation_status: EvaluationStatus
    errors: list[str]
    evaluation_report: dict[str, Any] | None

