"""chapter 04 reflection — 그래프 입력 연습.

쉽게 이해하기
-------------
Reflection은 만든 초안을 비평하고 그 피드백으로 다시 고치는 반복이다.
예: 코드 초안을 만들고 요구사항에 맞는지 검토한 뒤 수정한다.
수용 여부와 최대 수정 횟수에 따라 완료 또는 검토 필요 상태로 끝낸다.

그래프 구조
-----------
작업의 첫 초안을 작성하고 비평을 반영해 수정하며, 수용 기준이나 수정 상한에 따라 완료 또는 검토 필요로 끝낸다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Write a short release note about checkpoint replay.",
  "requirements": [
    "Mention replay",
    "Keep it concise"
  ],
  "max_iterations": 2
}
```
관찰할 결과: current_draft, critique_status, revision_history, final_output에서 비평·수정과 종료 조건을 확인합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_04_reflection.nodes import (
    critique_draft,
    finalize,
    generate_initial_draft,
    handle_failure,
    mark_needs_review,
    prepare_task,
    refine_draft,
)
from graphs.patterns.ch_04_reflection.state import ReflectionState


def route_after_prepare(
    state: ReflectionState,
) -> Literal["generate_initial_draft", "handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return "generate_initial_draft"


def route_after_draft(
    state: ReflectionState,
) -> Literal["critique_draft", "mark_needs_review", "handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    if state.get("critique_status") == "invalid":
        return "mark_needs_review"
    return "critique_draft"


def route_after_critique(
    state: ReflectionState,
) -> Literal["finalize", "refine_draft", "mark_needs_review"]:
    if state.get("critique_status") == "accepted":
        return "finalize"

    if (
        state.get("critique_status") == "needs_revision"
        and state.get("iteration", 0) < state.get("max_iterations", 1)
    ):
        return "refine_draft"

    return "mark_needs_review"


builder = StateGraph(ReflectionState)
builder.add_node("prepare_task", prepare_task)
builder.add_node("generate_initial_draft", generate_initial_draft)
builder.add_node("critique_draft", critique_draft)
builder.add_node("refine_draft", refine_draft)
builder.add_node("finalize", finalize)
builder.add_node("mark_needs_review", mark_needs_review)
builder.add_node("handle_failure", handle_failure)

builder.add_edge(START, "prepare_task")
builder.add_conditional_edges(
    "prepare_task",
    route_after_prepare,
    {
        "generate_initial_draft": "generate_initial_draft",
        "handle_failure": "handle_failure",
    },
)
builder.add_conditional_edges(
    "generate_initial_draft",
    route_after_draft,
    {
        "critique_draft": "critique_draft",
        "mark_needs_review": "mark_needs_review",
        "handle_failure": "handle_failure",
    },
)
builder.add_conditional_edges(
    "critique_draft",
    route_after_critique,
    {
        "finalize": "finalize",
        "refine_draft": "refine_draft",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_conditional_edges(
    "refine_draft",
    route_after_draft,
    {
        "critique_draft": "critique_draft",
        "mark_needs_review": "mark_needs_review",
        "handle_failure": "handle_failure",
    },
)
builder.add_edge("finalize", END)
builder.add_edge("mark_needs_review", END)
builder.add_edge("handle_failure", END)

graph = builder.compile()
