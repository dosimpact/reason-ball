"""chapter 15 inter agent communication a2a — 그래프 입력 연습.

쉽게 이해하기
-------------
Agent 간 통신은 다른 agent에게 작업을 요청하고 진행 상태와 결과를 받는 방식이다.
예: 조사 담당에게 작업을 보낸 뒤 완료 상태와 결과물을 확인한다.
이 예제는 모의 원격 응답을 포함해 작업 요청·조회·결과 수집 흐름을 보여준다.

그래프 구조
-----------
에이전트 정보를 검증해 위임 계획을 만들고, 기본 모의 A2A transport의 작업 상태와 결과물을 수집해 응답을 합친다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Research LangGraph checkpointing and summarize the findings.",
  "session_id": "input-demo-session"
}
```
관찰할 결과: validated_agent_cards, delegation_plan, task_statuses, remote_artifacts와 final_output을 확인합니다. 기본 구현은 mock A2A transport이며 실제 원격 에이전트 호출이 아닙니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_15_inter_agent_communication_a2a.nodes import (
    aggregate_remote_results,
    build_a2a_tasks,
    check_credentials,
    choose_interaction_mode,
    consume_stream_updates,
    discover_agent_cards,
    dispatch_sync_task,
    finalize_response,
    handle_input_required,
    handle_task_failure,
    plan_remote_delegation,
    poll_async_task,
    preprocess_request,
    process_remote_artifacts,
    start_async_task,
    validate_agent_cards,
)
from graphs.patterns.ch_15_inter_agent_communication_a2a.state import (
    InterAgentCommunicationA2AState,
)


def route_after_preprocess(
    state: InterAgentCommunicationA2AState,
) -> Literal["discover_agent_cards", "finalize_response"]:
    if state.get("status") == "failed":
        return "finalize_response"
    return "discover_agent_cards"


def route_after_validation(
    state: InterAgentCommunicationA2AState,
) -> Literal["plan_remote_delegation", "finalize_response"]:
    if not state.get("validated_agent_cards"):
        return "finalize_response"
    return "plan_remote_delegation"


def route_after_plan(
    state: InterAgentCommunicationA2AState,
) -> Literal["check_credentials", "finalize_response"]:
    if not state.get("delegation_plan"):
        return "finalize_response"
    return "check_credentials"


def route_after_credentials(
    state: InterAgentCommunicationA2AState,
) -> Literal["choose_interaction_mode", "handle_task_failure"]:
    if state.get("status") == "auth_failed":
        return "handle_task_failure"
    return "choose_interaction_mode"


def route_after_mode_selection(
    state: InterAgentCommunicationA2AState,
) -> Literal["build_a2a_tasks", "handle_task_failure"]:
    if state.get("status") == "unsupported":
        return "handle_task_failure"
    return "build_a2a_tasks"


def route_after_remote_interactions(
    state: InterAgentCommunicationA2AState,
) -> Literal["handle_input_required", "process_remote_artifacts"]:
    if _has_input_required(state):
        return "handle_input_required"
    return "process_remote_artifacts"


def route_after_artifact_processing(
    state: InterAgentCommunicationA2AState,
) -> Literal["handle_input_required", "aggregate_remote_results", "handle_task_failure"]:
    if _has_input_required(state):
        return "handle_input_required"
    if _completed_task_ids(state):
        return "aggregate_remote_results"
    return "handle_task_failure"


def _has_input_required(state: InterAgentCommunicationA2AState) -> bool:
    return any(
        status == "input-required"
        for status in state.get("task_statuses", {}).values()
    )


def _completed_task_ids(state: InterAgentCommunicationA2AState) -> list[str]:
    return [
        task_id
        for task_id, status in state.get("task_statuses", {}).items()
        if status == "completed"
    ]


builder = StateGraph(InterAgentCommunicationA2AState)
builder.add_node("preprocess_request", preprocess_request)
builder.add_node("discover_agent_cards", discover_agent_cards)
builder.add_node("validate_agent_cards", validate_agent_cards)
builder.add_node("plan_remote_delegation", plan_remote_delegation)
builder.add_node("check_credentials", check_credentials)
builder.add_node("choose_interaction_mode", choose_interaction_mode)
builder.add_node("build_a2a_tasks", build_a2a_tasks)
builder.add_node("dispatch_sync_task", dispatch_sync_task)
builder.add_node("start_async_task", start_async_task)
builder.add_node("poll_async_task", poll_async_task)
builder.add_node("consume_stream_updates", consume_stream_updates)
builder.add_node("process_remote_artifacts", process_remote_artifacts)
builder.add_node("aggregate_remote_results", aggregate_remote_results)
builder.add_node("handle_input_required", handle_input_required)
builder.add_node("handle_task_failure", handle_task_failure)
builder.add_node("finalize_response", finalize_response)

builder.add_edge(START, "preprocess_request")
builder.add_conditional_edges(
    "preprocess_request",
    route_after_preprocess,
    {
        "discover_agent_cards": "discover_agent_cards",
        "finalize_response": "finalize_response",
    },
)
builder.add_edge("discover_agent_cards", "validate_agent_cards")
builder.add_conditional_edges(
    "validate_agent_cards",
    route_after_validation,
    {
        "plan_remote_delegation": "plan_remote_delegation",
        "finalize_response": "finalize_response",
    },
)
builder.add_conditional_edges(
    "plan_remote_delegation",
    route_after_plan,
    {
        "check_credentials": "check_credentials",
        "finalize_response": "finalize_response",
    },
)
builder.add_conditional_edges(
    "check_credentials",
    route_after_credentials,
    {
        "choose_interaction_mode": "choose_interaction_mode",
        "handle_task_failure": "handle_task_failure",
    },
)
builder.add_conditional_edges(
    "choose_interaction_mode",
    route_after_mode_selection,
    {
        "build_a2a_tasks": "build_a2a_tasks",
        "handle_task_failure": "handle_task_failure",
    },
)
builder.add_edge("build_a2a_tasks", "dispatch_sync_task")
builder.add_edge("dispatch_sync_task", "start_async_task")
builder.add_edge("start_async_task", "poll_async_task")
builder.add_edge("poll_async_task", "consume_stream_updates")
builder.add_conditional_edges(
    "consume_stream_updates",
    route_after_remote_interactions,
    {
        "handle_input_required": "handle_input_required",
        "process_remote_artifacts": "process_remote_artifacts",
    },
)
builder.add_conditional_edges(
    "process_remote_artifacts",
    route_after_artifact_processing,
    {
        "handle_input_required": "handle_input_required",
        "aggregate_remote_results": "aggregate_remote_results",
        "handle_task_failure": "handle_task_failure",
    },
)
builder.add_edge("aggregate_remote_results", "finalize_response")
builder.add_edge("handle_input_required", "finalize_response")
builder.add_edge("handle_task_failure", "finalize_response")
builder.add_edge("finalize_response", END)

graph = builder.compile()
