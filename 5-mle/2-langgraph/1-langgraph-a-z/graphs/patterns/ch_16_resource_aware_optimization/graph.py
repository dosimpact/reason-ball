"""chapter 16 resource aware optimization — 그래프 입력 연습.

쉽게 이해하기
-------------
자원 최적화는 작업에 필요한 품질과 시간·비용을 보고 실행 경로를 고르는 것이다.
예: 간단한 질문은 빠른 모델로, 근거가 필요한 질문은 검색과 함께 처리한다.
이 그래프는 필요한 자원을 추정해 모델·검색 경로를 선택한다.

그래프 구조
-----------
요청의 품질·시간·비용 요구를 추정해 모델·검색 경로를 선택하고, 결과 평가에 따라 재시도하거나 대체 경로를 사용한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Explain checkpointing briefly.",
  "resource_limits": {
    "cost_usd": 0.05,
    "tokens": 1000,
    "tool_calls": 1,
    "time_ms": 5000
  }
}
```
관찰할 결과: selected_path, resource_budget, resource_usage, fallback_used와 final_output을 확인합니다. 비용/시간 추정과 실제 청구 상한은 다릅니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_16_resource_aware_optimization.nodes import (
    classify_request,
    critique_response,
    estimate_resource_needs,
    finalize,
    handle_execution_failure,
    maybe_upgrade_or_retry,
    prepare_context,
    preprocess_input,
    record_resource_observation,
    run_fallback_path,
    run_fast_model,
    run_grounded_model,
    run_reasoning_model,
    run_search_tool,
    select_execution_path,
)
from graphs.patterns.ch_16_resource_aware_optimization.state import (
    ResourceAwareOptimizationState,
)


def route_after_preprocess(
    state: ResourceAwareOptimizationState,
) -> Literal["prepare_context", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "prepare_context"


def route_selected_path(
    state: ResourceAwareOptimizationState,
) -> Literal["run_fast_model", "run_reasoning_model", "run_search_tool", "run_fallback_path", "finalize"]:
    selected = state.get("selected_path")
    if not selected:
        return "finalize"
    path_id = selected.get("id")
    if path_id == "fast":
        return "run_fast_model"
    if path_id == "reasoning":
        return "run_reasoning_model"
    if path_id == "grounded_search":
        return "run_search_tool"
    if path_id == "fallback":
        return "run_fallback_path"
    return "finalize"


def route_after_execution(
    state: ResourceAwareOptimizationState,
) -> Literal["handle_execution_failure", "critique_response"]:
    if state.get("status") == "failed":
        return "handle_execution_failure"
    return "critique_response"


def route_after_search(
    state: ResourceAwareOptimizationState,
) -> Literal["handle_execution_failure", "run_grounded_model"]:
    if state.get("status") == "failed":
        return "handle_execution_failure"
    return "run_grounded_model"


def route_after_retry_decision(
    state: ResourceAwareOptimizationState,
) -> Literal["estimate_resource_needs", "record_resource_observation"]:
    if state.get("retry_count", 0) > 0 and not state.get("model_response"):
        return "estimate_resource_needs"
    return "record_resource_observation"


builder = StateGraph(ResourceAwareOptimizationState)
builder.add_node("preprocess_input", preprocess_input)
builder.add_node("prepare_context", prepare_context)
builder.add_node("classify_request", classify_request)
builder.add_node("estimate_resource_needs", estimate_resource_needs)
builder.add_node("select_execution_path", select_execution_path)
builder.add_node("run_fast_model", run_fast_model)
builder.add_node("run_reasoning_model", run_reasoning_model)
builder.add_node("run_search_tool", run_search_tool)
builder.add_node("run_grounded_model", run_grounded_model)
builder.add_node("handle_execution_failure", handle_execution_failure)
builder.add_node("run_fallback_path", run_fallback_path)
builder.add_node("critique_response", critique_response)
builder.add_node("maybe_upgrade_or_retry", maybe_upgrade_or_retry)
builder.add_node("record_resource_observation", record_resource_observation)
builder.add_node("finalize", finalize)

builder.add_edge(START, "preprocess_input")
builder.add_conditional_edges(
    "preprocess_input",
    route_after_preprocess,
    {"prepare_context": "prepare_context", "finalize": "finalize"},
)
builder.add_edge("prepare_context", "classify_request")
builder.add_edge("classify_request", "estimate_resource_needs")
builder.add_edge("estimate_resource_needs", "select_execution_path")
builder.add_conditional_edges(
    "select_execution_path",
    route_selected_path,
    {
        "run_fast_model": "run_fast_model",
        "run_reasoning_model": "run_reasoning_model",
        "run_search_tool": "run_search_tool",
        "run_fallback_path": "run_fallback_path",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "run_fast_model",
    route_after_execution,
    {"handle_execution_failure": "handle_execution_failure", "critique_response": "critique_response"},
)
builder.add_conditional_edges(
    "run_reasoning_model",
    route_after_execution,
    {"handle_execution_failure": "handle_execution_failure", "critique_response": "critique_response"},
)
builder.add_conditional_edges(
    "run_search_tool",
    route_after_search,
    {"handle_execution_failure": "handle_execution_failure", "run_grounded_model": "run_grounded_model"},
)
builder.add_conditional_edges(
    "run_grounded_model",
    route_after_execution,
    {"handle_execution_failure": "handle_execution_failure", "critique_response": "critique_response"},
)
builder.add_edge("handle_execution_failure", "run_fallback_path")
builder.add_edge("run_fallback_path", "critique_response")
builder.add_edge("critique_response", "maybe_upgrade_or_retry")
builder.add_conditional_edges(
    "maybe_upgrade_or_retry",
    route_after_retry_decision,
    {
        "estimate_resource_needs": "estimate_resource_needs",
        "record_resource_observation": "record_resource_observation",
    },
)
builder.add_edge("record_resource_observation", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
