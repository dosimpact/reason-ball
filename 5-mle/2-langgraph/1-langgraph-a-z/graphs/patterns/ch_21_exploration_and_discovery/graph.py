"""chapter 21 exploration and discovery — 그래프 입력 연습.

쉽게 이해하기
-------------
탐색과 발견은 가능한 가설을 여러 개 만들고 근거를 살펴 다음 조사 대상을 고르는 과정이다.
예: 문제의 원인 후보를 만들고 유망한 후보를 더 구체화한다.
생성한 가설을 검토·정렬하며 필요한 경우 다시 다듬는다.

그래프 구조
-----------
연구 목표와 맥락에서 가설을 생성·검토·정렬하고, 필요한 가설을 다듬어 검증 계획과 탐색 보고서를 제안한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "research_goal": "Explore ways to improve a developer onboarding guide.",
  "domain": "software",
  "seed_context": [
    "Learners need short runnable examples."
  ],
  "max_iterations": 1
}
```
관찰할 결과: candidate_hypotheses, review_results, ranked_hypotheses, validation_plan과 discovery_brief를 확인합니다. 제안된 가설은 검증된 사실이 아닙니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_21_exploration_and_discovery.nodes import (
    cluster_hypotheses,
    decide_refinement,
    evolve_hypotheses,
    explore_context,
    finalize_discovery_brief,
    generate_hypotheses,
    identify_knowledge_gaps,
    plan_validation_steps,
    prepare_discovery_task,
    rank_hypotheses,
    request_human_review,
    review_hypotheses,
    safety_screen_goal,
)
from graphs.patterns.ch_21_exploration_and_discovery.state import (
    ExplorationDiscoveryState,
)


def route_after_prepare(
    state: ExplorationDiscoveryState,
) -> Literal["safety_screen_goal", "finalize_discovery_brief"]:
    if state.get("discovery_status") == "failed":
        return "finalize_discovery_brief"
    return "safety_screen_goal"


def route_after_safety(
    state: ExplorationDiscoveryState,
) -> Literal["explore_context", "finalize_discovery_brief"]:
    if state.get("discovery_status") == "blocked":
        return "finalize_discovery_brief"
    return "explore_context"


def route_after_generation(
    state: ExplorationDiscoveryState,
) -> Literal["review_hypotheses", "finalize_discovery_brief"]:
    if state.get("discovery_status") in {"failed", "needs_review"}:
        return "finalize_discovery_brief"
    return "review_hypotheses"


def route_after_review(
    state: ExplorationDiscoveryState,
) -> Literal["rank_hypotheses", "finalize_discovery_brief"]:
    if state.get("discovery_status") in {"failed", "needs_review"}:
        return "finalize_discovery_brief"
    return "rank_hypotheses"


def route_after_decision(
    state: ExplorationDiscoveryState,
) -> Literal[
    "evolve_hypotheses",
    "plan_validation_steps",
    "request_human_review",
    "finalize_discovery_brief",
]:
    if state.get("discovery_status") == "needs_review" or state.get("needs_human_review"):
        return "request_human_review"
    if state.get("discovery_status") == "failed":
        return "finalize_discovery_brief"
    if state.get("selected_hypotheses"):
        return "plan_validation_steps"
    if state.get("iteration_count", 0) < state.get("max_iterations", 1):
        return "evolve_hypotheses"
    return "finalize_discovery_brief"


builder = StateGraph(ExplorationDiscoveryState)
builder.add_node("prepare_discovery_task", prepare_discovery_task)
builder.add_node("safety_screen_goal", safety_screen_goal)
builder.add_node("explore_context", explore_context)
builder.add_node("identify_knowledge_gaps", identify_knowledge_gaps)
builder.add_node("generate_hypotheses", generate_hypotheses)
builder.add_node("review_hypotheses", review_hypotheses)
builder.add_node("rank_hypotheses", rank_hypotheses)
builder.add_node("cluster_hypotheses", cluster_hypotheses)
builder.add_node("decide_refinement", decide_refinement)
builder.add_node("evolve_hypotheses", evolve_hypotheses)
builder.add_node("plan_validation_steps", plan_validation_steps)
builder.add_node("request_human_review", request_human_review)
builder.add_node("finalize_discovery_brief", finalize_discovery_brief)

builder.add_edge(START, "prepare_discovery_task")
builder.add_conditional_edges(
    "prepare_discovery_task",
    route_after_prepare,
    {
        "safety_screen_goal": "safety_screen_goal",
        "finalize_discovery_brief": "finalize_discovery_brief",
    },
)
builder.add_conditional_edges(
    "safety_screen_goal",
    route_after_safety,
    {
        "explore_context": "explore_context",
        "finalize_discovery_brief": "finalize_discovery_brief",
    },
)
builder.add_edge("explore_context", "identify_knowledge_gaps")
builder.add_edge("identify_knowledge_gaps", "generate_hypotheses")
builder.add_conditional_edges(
    "generate_hypotheses",
    route_after_generation,
    {
        "review_hypotheses": "review_hypotheses",
        "finalize_discovery_brief": "finalize_discovery_brief",
    },
)
builder.add_conditional_edges(
    "review_hypotheses",
    route_after_review,
    {
        "rank_hypotheses": "rank_hypotheses",
        "finalize_discovery_brief": "finalize_discovery_brief",
    },
)
builder.add_edge("rank_hypotheses", "cluster_hypotheses")
builder.add_edge("cluster_hypotheses", "decide_refinement")
builder.add_conditional_edges(
    "decide_refinement",
    route_after_decision,
    {
        "evolve_hypotheses": "evolve_hypotheses",
        "plan_validation_steps": "plan_validation_steps",
        "request_human_review": "request_human_review",
        "finalize_discovery_brief": "finalize_discovery_brief",
    },
)
builder.add_edge("evolve_hypotheses", "review_hypotheses")
builder.add_edge("plan_validation_steps", "finalize_discovery_brief")
builder.add_edge("request_human_review", "finalize_discovery_brief")
builder.add_edge("finalize_discovery_brief", END)

graph = builder.compile()

