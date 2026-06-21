from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from agentic_design_patterns.patterns.chapter_01_prompt_chaining.nodes import (
    extract_specs,
    finalize,
    mark_needs_review,
    prepare_input,
    repair_output,
    transform_to_json,
    validate_output,
)
from agentic_design_patterns.patterns.chapter_01_prompt_chaining.state import (
    PromptChainingState,
)


# 입력 준비 단계에서 이미 실패가 확정되면 LLM 호출 없이 종료 경로로 보낸다.
def route_after_prepare(
    state: PromptChainingState,
) -> Literal["extract_specs", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "extract_specs"


# LLM 호출 노드 뒤에는 공통적으로 런타임 실패 여부를 먼저 확인한다.
def route_after_model_call(
    next_node: str,
):
    def _route(state: PromptChainingState) -> str:
        if state.get("status") == "failed":
            return "finalize"
        return next_node

    return _route


# 검증 결과가 성공이면 종료하고, 실패하면 제한 횟수 안에서 복구 프롬프트를 한 번 더 시도한다.
def route_after_validation(
    state: PromptChainingState,
) -> Literal["finalize", "repair_output", "mark_needs_review"]:
    if state.get("status") == "ok":
        return "finalize"

    if state.get("retry_count", 0) < state.get("max_retries", 1):
        return "repair_output"

    return "mark_needs_review"


# 프롬프트 체이닝의 큰 흐름:
# 입력 정리 -> 사양 추출 -> JSON 변환 -> 검증 -> 성공/복구/검토 종료.
builder = StateGraph(PromptChainingState)
builder.add_node("prepare_input", prepare_input)
builder.add_node("extract_specs", extract_specs)
builder.add_node("transform_to_json", transform_to_json)
builder.add_node("validate_output", validate_output)
builder.add_node("repair_output", repair_output)
builder.add_node("finalize", finalize)
builder.add_node("mark_needs_review", mark_needs_review)

builder.add_edge(START, "prepare_input")
builder.add_conditional_edges(
    "prepare_input",
    route_after_prepare,
    {
        "extract_specs": "extract_specs",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "extract_specs",
    route_after_model_call("transform_to_json"),
    {
        "transform_to_json": "transform_to_json",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "transform_to_json",
    route_after_model_call("validate_output"),
    {
        "validate_output": "validate_output",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "repair_output",
    route_after_model_call("validate_output"),
    {
        "validate_output": "validate_output",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "validate_output",
    route_after_validation,
    {
        "finalize": "finalize",
        "repair_output": "repair_output",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("finalize", END)
builder.add_edge("mark_needs_review", END)

graph = builder.compile()
