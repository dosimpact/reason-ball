"""chapter 09 learning and adaptation — 그래프 입력 연습.

쉽게 이해하기
-------------
Learning and adaptation은 결과와 피드백을 다음 전략 선택에 활용하는 과정이다.
예: 이전에 부족했던 답변 방식을 다음 요청에서 보완한다.
과거 경험을 조회하고 평가 결과로 전략을 갱신하는 흐름을 보여준다.

그래프 구조
-----------
과거 경험을 조회해 응답 전략을 선택하고, 결과 평가와 피드백에 따른 전략 변경을 저장한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Explain checkpoint replay in one concise paragraph.",
  "user_id": "input-demo-user",
  "max_retries": 1
}
```
관찰할 결과: selected_strategy, evaluation, adaptation_record, final_output을 확인합니다. 피드백에 따른 정책 변경은 평가 결과에 따릅니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_09_learning_and_adaptation.nodes import (
    adapt_from_result,
    apply_adaptation,
    classify_task,
    collect_feedback,
    evaluate_response,
    finalize,
    generate_response,
    mark_needs_review,
    persist_adaptation,
    preprocess_input,
    retrieve_experience,
    revise_strategy,
    select_strategy,
)
from graphs.patterns.ch_09_learning_and_adaptation.state import (
    LearningAdaptationState,
)


def route_after_preprocess(
    state: LearningAdaptationState,
) -> Literal["classify_task", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "classify_task"


def route_after_evaluation(
    state: LearningAdaptationState,
) -> Literal["adapt_from_result", "revise_strategy", "mark_needs_review"]:
    evaluation = state.get("evaluation", {})
    if evaluation.get("passed") and not state.get("needs_human_review", False):
        return "adapt_from_result"

    if _requires_review(state):
        return "mark_needs_review"

    if evaluation.get("recoverable") and state.get("retry_count", 0) < state.get(
        "max_retries", 1
    ):
        return "revise_strategy"

    return "mark_needs_review"


def _requires_review(state: LearningAdaptationState) -> bool:
    evaluation = state.get("evaluation", {})
    return bool(
        state.get("needs_human_review", False)
        or evaluation.get("safety_flags")
        or evaluation.get("unsupported_claims")
        or (
            evaluation.get("missing_information")
            and state.get("retry_count", 0) >= state.get("max_retries", 1)
        )
    )


builder = StateGraph(LearningAdaptationState)
builder.add_node("preprocess_input", preprocess_input)
builder.add_node("classify_task", classify_task)
builder.add_node("retrieve_experience", retrieve_experience)
builder.add_node("select_strategy", select_strategy)
builder.add_node("generate_response", generate_response)
builder.add_node("collect_feedback", collect_feedback)
builder.add_node("evaluate_response", evaluate_response)
builder.add_node("revise_strategy", revise_strategy)
builder.add_node("mark_needs_review", mark_needs_review)
builder.add_node("adapt_from_result", adapt_from_result)
builder.add_node("apply_adaptation", apply_adaptation)
builder.add_node("persist_adaptation", persist_adaptation)
builder.add_node("finalize", finalize)

builder.add_edge(START, "preprocess_input")
builder.add_conditional_edges(
    "preprocess_input",
    route_after_preprocess,
    {
        "classify_task": "classify_task",
        "finalize": "finalize",
    },
)
builder.add_edge("classify_task", "retrieve_experience")
builder.add_edge("retrieve_experience", "select_strategy")
builder.add_edge("select_strategy", "generate_response")
builder.add_edge("generate_response", "collect_feedback")
builder.add_edge("collect_feedback", "evaluate_response")
builder.add_conditional_edges(
    "evaluate_response",
    route_after_evaluation,
    {
        "adapt_from_result": "adapt_from_result",
        "revise_strategy": "revise_strategy",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("revise_strategy", "generate_response")
builder.add_edge("mark_needs_review", "adapt_from_result")
builder.add_edge("adapt_from_result", "apply_adaptation")
builder.add_edge("apply_adaptation", "persist_adaptation")
builder.add_edge("persist_adaptation", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
