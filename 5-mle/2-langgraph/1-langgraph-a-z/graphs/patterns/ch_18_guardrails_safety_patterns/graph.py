"""chapter 18 guardrails safety patterns — 그래프 입력 연습.

쉽게 이해하기
-------------
Guardrail은 입력·도구 호출·출력이 정한 정책을 따르는지 검사하는 규칙이다.
예: 허용하지 않은 도구 요청은 실행 전에 차단한다.
이 그래프는 입력 검사, 도구 검사, 출력 검사를 서로 다른 단계로 둔다.

그래프 구조
-----------
입력·도구 호출·출력에 정책 검사를 적용하고, 판정에 따라 차단·수정·사람 검토를 거쳐 응답을 확정한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Explain how to keep account data private.",
  "session_user_id": "input-demo-user"
}
```
관찰할 결과: input_policy_decision, output_policy_decision, audit_events, status와 final_output을 확인합니다. 도구 범위와 사람 검토 정책은 별도 필드로 설정합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_18_guardrails_safety_patterns.nodes import (
    apply_human_review,
    block_input,
    evaluate_input_policy,
    evaluate_output_policy,
    execute_tool,
    finalize,
    generate_primary_response,
    preprocess_input,
    repair_output,
    request_human_review,
    synthesize_tool_response,
    validate_tool_call,
)
from graphs.patterns.ch_18_guardrails_safety_patterns.state import (
    GuardrailsSafetyState,
)


def route_after_preprocess(
    state: GuardrailsSafetyState,
) -> Literal["evaluate_input_policy", "finalize"]:
    if state.get("status") == "error":
        return "finalize"
    return "evaluate_input_policy"


def route_after_input_policy(
    state: GuardrailsSafetyState,
) -> Literal["block_input", "request_human_review", "generate_primary_response"]:
    decision = (state.get("input_policy_decision") or {}).get("decision")
    if decision == "unsafe":
        return "block_input"
    if decision == "review" or state.get("needs_human_review"):
        return "request_human_review"
    return "generate_primary_response"


def route_after_primary_response(
    state: GuardrailsSafetyState,
) -> Literal["validate_tool_call", "evaluate_output_policy"]:
    if state.get("requested_tool_call"):
        return "validate_tool_call"
    return "evaluate_output_policy"


def route_after_tool_policy(
    state: GuardrailsSafetyState,
) -> Literal["execute_tool", "request_human_review", "evaluate_output_policy"]:
    decision = (state.get("tool_policy_decision") or {}).get("decision")
    if decision == "safe":
        return "execute_tool"
    if decision == "review":
        return "request_human_review"
    return "evaluate_output_policy"


def route_after_output_policy(
    state: GuardrailsSafetyState,
) -> Literal["finalize", "repair_output", "request_human_review", "block_input"]:
    decision = state.get("output_policy_decision") or {}
    if decision.get("decision") == "safe":
        return "finalize"
    if decision.get("decision") == "review":
        return "request_human_review"
    if decision.get("recoverable") and state.get("repair_attempts", 0) < 1:
        return "repair_output"
    if state.get("repair_attempts", 0) >= 1:
        return "request_human_review"
    return "block_input"


builder = StateGraph(GuardrailsSafetyState)
builder.add_node("preprocess_input", preprocess_input)
builder.add_node("evaluate_input_policy", evaluate_input_policy)
builder.add_node("block_input", block_input)
builder.add_node("generate_primary_response", generate_primary_response)
builder.add_node("validate_tool_call", validate_tool_call)
builder.add_node("execute_tool", execute_tool)
builder.add_node("synthesize_tool_response", synthesize_tool_response)
builder.add_node("evaluate_output_policy", evaluate_output_policy)
builder.add_node("repair_output", repair_output)
builder.add_node("request_human_review", request_human_review)
builder.add_node("apply_human_review", apply_human_review)
builder.add_node("finalize", finalize)

builder.add_edge(START, "preprocess_input")
builder.add_conditional_edges(
    "preprocess_input",
    route_after_preprocess,
    {
        "evaluate_input_policy": "evaluate_input_policy",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "evaluate_input_policy",
    route_after_input_policy,
    {
        "block_input": "block_input",
        "request_human_review": "request_human_review",
        "generate_primary_response": "generate_primary_response",
    },
)
builder.add_conditional_edges(
    "generate_primary_response",
    route_after_primary_response,
    {
        "validate_tool_call": "validate_tool_call",
        "evaluate_output_policy": "evaluate_output_policy",
    },
)
builder.add_conditional_edges(
    "validate_tool_call",
    route_after_tool_policy,
    {
        "execute_tool": "execute_tool",
        "request_human_review": "request_human_review",
        "evaluate_output_policy": "evaluate_output_policy",
    },
)
builder.add_edge("execute_tool", "synthesize_tool_response")
builder.add_edge("synthesize_tool_response", "evaluate_output_policy")
builder.add_conditional_edges(
    "evaluate_output_policy",
    route_after_output_policy,
    {
        "finalize": "finalize",
        "repair_output": "repair_output",
        "request_human_review": "request_human_review",
        "block_input": "block_input",
    },
)
builder.add_edge("repair_output", "evaluate_output_policy")
builder.add_edge("request_human_review", "apply_human_review")
builder.add_edge("apply_human_review", "finalize")
builder.add_edge("block_input", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
