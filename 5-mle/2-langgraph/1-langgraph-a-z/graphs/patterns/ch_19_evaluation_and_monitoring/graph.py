"""chapter 19 evaluation and monitoring — 그래프 입력 연습.

쉽게 이해하기
-------------
평가는 결과가 기준에 맞는지 확인하고, 모니터링은 품질과 실행 지표의 변화를 살피는 것이다.
예: 답변 품질이 떨어지거나 지연 시간이 늘어난 실행을 찾아본다.
이 그래프는 규칙·지표·필요한 judge 평가를 모아 상태를 판단한다.

그래프 구조
-----------
기록된 응답·도구 실행 경로·운영 지표를 평가하고, 필요하면 모델 심사를 더해 회귀·이상 징후와 평가 보고서를 만든다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Evaluate a simple recorded answer.",
  "agent_run": {
    "final_output": "The answer is 42.",
    "tool_calls": []
  },
  "reference_output": "The answer is 42.",
  "expected_trajectory": []
}
```
관찰할 결과: response_metrics, trajectory_metrics, operational_metrics와 evaluation_report를 확인합니다. rubric을 주지 않은 기본 평가와 LLM judge를 구분합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_19_evaluation_and_monitoring.nodes import (
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
from graphs.patterns.ch_19_evaluation_and_monitoring.state import (
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
