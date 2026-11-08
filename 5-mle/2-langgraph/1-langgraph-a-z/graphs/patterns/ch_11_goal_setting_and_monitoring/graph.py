"""chapter 11 goal setting and monitoring — 그래프 입력 연습.

쉽게 이해하기
-------------
목표 모니터링은 완료 기준을 먼저 정하고 결과가 그 기준을 채우는지 확인하는 것이다.
예: 함수가 두 수를 더하고 타입 힌트를 갖췄는지 확인한다.
goal contract가 기준을 담고 검사·평가 단계가 수정 여부를 정한다.

그래프 구조
-----------
목표를 검증 가능한 조건으로 정의하고, 생성 결과를 검사·모니터링하며 조건 충족 또는 상한까지 수정한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Write a pure Python function that adds two integers.",
  "use_case": "integer addition function",
  "raw_goals": [
    "Return the sum of two integers",
    "Use type hints"
  ],
  "max_iterations": 2
}
```
관찰할 결과: goal_contract, check_results, monitoring_report, goal_status와 final_output을 확인합니다. 후보 코드 생성과 정적 검사를 실제 배포/실행 성공으로 해석하지 않습니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_11_goal_setting_and_monitoring.nodes import (
    define_goal_contract,
    finalize,
    generate_candidate,
    mark_needs_review,
    monitor_candidate,
    prepare_input,
    revise_candidate,
    run_objective_checks,
    validate_goal_contract,
)
from graphs.patterns.ch_11_goal_setting_and_monitoring.state import (
    GoalMonitoringState,
)


def route_after_prepare(
    state: GoalMonitoringState,
) -> Literal["define_goal_contract", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "define_goal_contract"


def route_after_goal_validation(
    state: GoalMonitoringState,
) -> Literal["generate_candidate", "mark_needs_review"]:
    if state.get("needs_human_review") or state.get("goal_status") in {
        "needs_review",
        "failed",
    }:
        return "mark_needs_review"
    return "generate_candidate"


def route_after_generation(
    state: GoalMonitoringState,
) -> Literal["run_objective_checks", "mark_needs_review"]:
    if state.get("status") == "failed" or state.get("goal_status") == "failed":
        return "mark_needs_review"
    return "run_objective_checks"


def route_after_monitoring(
    state: GoalMonitoringState,
) -> Literal["finalize", "revise_candidate", "mark_needs_review"]:
    if state.get("goal_status") == "met":
        return "finalize"
    if (
        state.get("goal_status") == "needs_revision"
        and state.get("iteration_count", 0) < state.get("max_iterations", 1)
    ):
        return "revise_candidate"
    return "mark_needs_review"


builder = StateGraph(GoalMonitoringState)
builder.add_node("prepare_input", prepare_input)
builder.add_node("define_goal_contract", define_goal_contract)
builder.add_node("validate_goal_contract", validate_goal_contract)
builder.add_node("generate_candidate", generate_candidate)
builder.add_node("run_objective_checks", run_objective_checks)
builder.add_node("monitor_candidate", monitor_candidate)
builder.add_node("revise_candidate", revise_candidate)
builder.add_node("mark_needs_review", mark_needs_review)
builder.add_node("finalize", finalize)

builder.add_edge(START, "prepare_input")
builder.add_conditional_edges(
    "prepare_input",
    route_after_prepare,
    {
        "define_goal_contract": "define_goal_contract",
        "finalize": "finalize",
    },
)
builder.add_edge("define_goal_contract", "validate_goal_contract")
builder.add_conditional_edges(
    "validate_goal_contract",
    route_after_goal_validation,
    {
        "generate_candidate": "generate_candidate",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "generate_candidate",
    route_after_generation,
    {
        "run_objective_checks": "run_objective_checks",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "revise_candidate",
    route_after_generation,
    {
        "run_objective_checks": "run_objective_checks",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("run_objective_checks", "monitor_candidate")
builder.add_conditional_edges(
    "monitor_candidate",
    route_after_monitoring,
    {
        "finalize": "finalize",
        "revise_candidate": "revise_candidate",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("mark_needs_review", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
