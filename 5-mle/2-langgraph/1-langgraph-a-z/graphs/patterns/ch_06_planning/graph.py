"""chapter 06 planning — 그래프 입력 연습.

쉽게 이해하기
-------------
Planning은 목표를 실행할 단계로 나누고 진행에 따라 계획을 고치는 것이다.
예: 조사 → 정리 → 보고 순서를 정하고 막힌 단계가 있으면 재계획한다.
계획을 검증한 뒤 한 단계씩 실행하고 진행 상태를 다시 평가한다.

그래프 구조
-----------
목표를 계획으로 만들고 검증·검토한 뒤 단계별로 실행하며, 진행 평가에 따라 재계획하거나 보고서를 만든다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Prepare a short report comparing LangGraph checkpoint and long-term memory.",
  "max_steps": 4
}
```
관찰할 결과: plan, approved_plan, step_results, replan_count, final_report에서 계획 검증과 진행 상태를 확인합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_06_planning.nodes import (
    assess_progress,
    create_plan,
    execute_step,
    mark_needs_review,
    prepare_input,
    repair_plan,
    replan,
    review_plan,
    select_next_step,
    synthesize_report,
    validate_plan,
)
from graphs.patterns.ch_06_planning.state import PlanningState


def route_after_prepare(
    state: PlanningState,
) -> Literal["create_plan", "mark_needs_review"]:
    if state.get("status") == "failed":
        return "mark_needs_review"
    return "create_plan"


def route_after_validation(
    state: PlanningState,
) -> Literal["review_plan", "repair_plan", "mark_needs_review"]:
    if state.get("status") == "failed":
        return "mark_needs_review"
    if not state.get("plan_errors"):
        return "review_plan"
    if state.get("repair_count", 0) < state.get("max_repairs", 1):
        return "repair_plan"
    return "mark_needs_review"


def route_after_review(
    state: PlanningState,
) -> Literal["select_next_step", "mark_needs_review"]:
    if state.get("status") == "needs_review":
        return "mark_needs_review"
    return "select_next_step"


def route_after_select(
    state: PlanningState,
) -> Literal["execute_step", "synthesize_report", "mark_needs_review"]:
    if state.get("next_action") == "mark_needs_review":
        return "mark_needs_review"
    if state.get("current_step_id"):
        return "execute_step"
    return "synthesize_report"


def route_after_execute(
    state: PlanningState,
) -> Literal["assess_progress", "mark_needs_review"]:
    if state.get("status") == "needs_review":
        return "mark_needs_review"
    return "assess_progress"


def route_after_assessment(
    state: PlanningState,
) -> Literal[
    "select_next_step",
    "replan",
    "synthesize_report",
    "mark_needs_review",
]:
    next_action = state.get("next_action")
    if next_action == "replan":
        return "replan"
    if next_action == "synthesize_report":
        return "synthesize_report"
    if next_action == "mark_needs_review":
        return "mark_needs_review"
    return "select_next_step"


builder = StateGraph(PlanningState)
builder.add_node("prepare_input", prepare_input)
builder.add_node("create_plan", create_plan)
builder.add_node("validate_plan", validate_plan)
builder.add_node("repair_plan", repair_plan)
builder.add_node("review_plan", review_plan)
builder.add_node("select_next_step", select_next_step)
builder.add_node("execute_step", execute_step)
builder.add_node("assess_progress", assess_progress)
builder.add_node("replan", replan)
builder.add_node("synthesize_report", synthesize_report)
builder.add_node("mark_needs_review", mark_needs_review)

builder.add_edge(START, "prepare_input")
builder.add_conditional_edges(
    "prepare_input",
    route_after_prepare,
    {
        "create_plan": "create_plan",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("create_plan", "validate_plan")
builder.add_edge("repair_plan", "validate_plan")
builder.add_edge("replan", "validate_plan")
builder.add_conditional_edges(
    "validate_plan",
    route_after_validation,
    {
        "review_plan": "review_plan",
        "repair_plan": "repair_plan",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "review_plan",
    route_after_review,
    {
        "select_next_step": "select_next_step",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "select_next_step",
    route_after_select,
    {
        "execute_step": "execute_step",
        "synthesize_report": "synthesize_report",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "execute_step",
    route_after_execute,
    {
        "assess_progress": "assess_progress",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "assess_progress",
    route_after_assessment,
    {
        "select_next_step": "select_next_step",
        "replan": "replan",
        "synthesize_report": "synthesize_report",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("synthesize_report", END)
builder.add_edge("mark_needs_review", END)

graph = builder.compile()
