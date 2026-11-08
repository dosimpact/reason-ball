"""chapter 03 parallelization — 그래프 입력 연습.

쉽게 이해하기
-------------
Parallelization은 서로 기다릴 필요가 없는 작업을 나눠 함께 실행하는 것이다.
예: 같은 주제의 요약·질문·핵심어를 각각 만든 뒤 하나로 모은다.
분기 결과를 수집한 뒤 최종 답변을 구성한다.

그래프 구조
-----------
같은 주제의 요약·질문·핵심어를 병렬로 생성하고, 각 분기 결과를 모아 최종 답변을 구성한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Explain LangGraph checkpointing for beginners."
}
```
관찰할 결과: summary/questions/key_terms의 branch_outputs와 completed_branches, final_answer를 확인합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_03_parallelization.nodes import (
    collect_branch_outputs,
    extract_key_terms,
    fan_out_branches,
    generate_questions,
    handle_failure,
    initialize,
    summarize_topic,
    synthesize_answer,
)
from graphs.patterns.ch_03_parallelization.state import (
    ParallelizationState,
)


def route_after_initialize(
    state: ParallelizationState,
) -> Literal["fan_out_branches", "handle_failure"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return "fan_out_branches"


def route_after_synthesis(
    state: ParallelizationState,
) -> Literal["handle_failure", "__end__"]:
    if state.get("status") == "failed":
        return "handle_failure"
    return END


builder = StateGraph(ParallelizationState)
builder.add_node("initialize", initialize)
builder.add_node("fan_out_branches", fan_out_branches)
builder.add_node("summarize_topic", summarize_topic)
builder.add_node("generate_questions", generate_questions)
builder.add_node("extract_key_terms", extract_key_terms)
builder.add_node("collect_branch_outputs", collect_branch_outputs)
builder.add_node("synthesize_answer", synthesize_answer)
builder.add_node("handle_failure", handle_failure)

builder.add_edge(START, "initialize")
builder.add_conditional_edges(
    "initialize",
    route_after_initialize,
    {
        "fan_out_branches": "fan_out_branches",
        "handle_failure": "handle_failure",
    },
)
builder.add_edge("fan_out_branches", "summarize_topic")
builder.add_edge("fan_out_branches", "generate_questions")
builder.add_edge("fan_out_branches", "extract_key_terms")
builder.add_edge("summarize_topic", "collect_branch_outputs")
builder.add_edge("generate_questions", "collect_branch_outputs")
builder.add_edge("extract_key_terms", "collect_branch_outputs")
builder.add_edge("collect_branch_outputs", "synthesize_answer")
builder.add_conditional_edges(
    "synthesize_answer",
    route_after_synthesis,
    {
        "handle_failure": "handle_failure",
        END: END,
    },
)
builder.add_edge("handle_failure", END)

graph = builder.compile()
