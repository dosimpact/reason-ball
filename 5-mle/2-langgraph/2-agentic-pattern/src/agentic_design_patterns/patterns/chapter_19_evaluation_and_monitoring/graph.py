from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_19_evaluation_and_monitoring.nodes import (
    audit_requirements,
    decide_evaluation_status,
    decide_judge_need,
    detect_regressions_and_anomalies,
    evaluate_trajectory,
    finalize_report,
    prepare_evaluation,
    run_rubric_judge,
    score_operational_metrics,
    score_response_quality,
    validate_judge_result,
)
from agentic_design_patterns.patterns.chapter_19_evaluation_and_monitoring.state import (
    EvaluationMonitoringState,
)


def route_after_prepare(
    state: EvaluationMonitoringState,
) -> Literal["score_response_quality", "finalize_report"]:
    if state.get("evaluation_status") == "invalid":
        return "finalize_report"
    return "score_response_quality"


def route_after_judge_decision(
    state: EvaluationMonitoringState,
) -> Literal["run_rubric_judge", "detect_regressions_and_anomalies"]:
    if state.get("drift_signals", {}).get("needs_judge"):
        return "run_rubric_judge"
    return "detect_regressions_and_anomalies"


builder = StateGraph(EvaluationMonitoringState)
builder.add_node("prepare_evaluation", prepare_evaluation)
builder.add_node("score_response_quality", score_response_quality)
builder.add_node("score_operational_metrics", score_operational_metrics)
builder.add_node("evaluate_trajectory", evaluate_trajectory)
builder.add_node("audit_requirements", audit_requirements)
builder.add_node("decide_judge_need", decide_judge_need)
builder.add_node("run_rubric_judge", run_rubric_judge)
builder.add_node("validate_judge_result", validate_judge_result)
builder.add_node("detect_regressions_and_anomalies", detect_regressions_and_anomalies)
builder.add_node("decide_evaluation_status", decide_evaluation_status)
builder.add_node("finalize_report", finalize_report)

builder.add_edge(START, "prepare_evaluation")
builder.add_conditional_edges(
    "prepare_evaluation",
    route_after_prepare,
    {
        "score_response_quality": "score_response_quality",
        "finalize_report": "finalize_report",
    },
)
builder.add_edge("score_response_quality", "score_operational_metrics")
builder.add_edge("score_operational_metrics", "evaluate_trajectory")
builder.add_edge("evaluate_trajectory", "audit_requirements")
builder.add_edge("audit_requirements", "decide_judge_need")
builder.add_conditional_edges(
    "decide_judge_need",
    route_after_judge_decision,
    {
        "run_rubric_judge": "run_rubric_judge",
        "detect_regressions_and_anomalies": "detect_regressions_and_anomalies",
    },
)
builder.add_edge("run_rubric_judge", "validate_judge_result")
builder.add_edge("validate_judge_result", "detect_regressions_and_anomalies")
builder.add_edge("detect_regressions_and_anomalies", "decide_evaluation_status")
builder.add_edge("decide_evaluation_status", "finalize_report")
builder.add_edge("finalize_report", END)

graph = builder.compile()
