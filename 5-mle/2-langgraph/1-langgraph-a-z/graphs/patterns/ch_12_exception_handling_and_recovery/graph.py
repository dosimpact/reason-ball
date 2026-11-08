"""chapter 12 exception handling and recovery — 그래프 입력 연습.

쉽게 이해하기
-------------
오류 복구는 실패 이유를 보고 재시도하거나 가능한 다른 방법을 선택하는 것이다.
예: 상세 위치 조회가 실패하면 다시 시도하거나 넓은 지역 정보로 답한다.
이 그래프는 실패 진단과 대체 조회를 별도 경로로 둔다.

그래프 구조
-----------
연습용 장소 조회 실패의 원인을 진단해 정밀 조회를 재시도하거나 넓은 지역 조회로 대체하고, 복구 결과 또는 검토 요청을 반환한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Find the location of 123 Main Street, Seoul.",
  "max_retries": 1
}
```
관찰할 결과: primary_result, tool_errors, recovery_action, fallback_result와 final_output을 확인합니다. 조회 도구의 고정 fixture와 실제 위치 서비스를 구분합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_12_exception_handling_and_recovery.nodes import (
    call_general_area_lookup,
    call_precise_lookup,
    diagnose_failure,
    finalize_response,
    mark_for_review,
    parse_location_query,
    prepare_request,
    retry_precise_lookup,
    select_recovered_result,
)
from graphs.patterns.ch_12_exception_handling_and_recovery.state import (
    ExceptionRecoveryState,
)


def route_after_prepare(
    state: ExceptionRecoveryState,
) -> Literal["parse_location_query", "mark_for_review"]:
    if state.get("recovery_action") == "review":
        return "mark_for_review"
    return "parse_location_query"


def route_after_diagnosis(
    state: ExceptionRecoveryState,
) -> Literal[
    "select_recovered_result",
    "retry_precise_lookup",
    "call_general_area_lookup",
    "mark_for_review",
]:
    action = state.get("recovery_action")
    if action == "return_primary":
        return "select_recovered_result"
    if action == "retry":
        return "retry_precise_lookup"
    if action == "fallback":
        return "call_general_area_lookup"
    return "mark_for_review"


builder = StateGraph(ExceptionRecoveryState)
builder.add_node("prepare_request", prepare_request)
builder.add_node("parse_location_query", parse_location_query)
builder.add_node("call_precise_lookup", call_precise_lookup)
builder.add_node("diagnose_failure", diagnose_failure)
builder.add_node("retry_precise_lookup", retry_precise_lookup)
builder.add_node("call_general_area_lookup", call_general_area_lookup)
builder.add_node("select_recovered_result", select_recovered_result)
builder.add_node("mark_for_review", mark_for_review)
builder.add_node("finalize_response", finalize_response)

builder.add_edge(START, "prepare_request")
builder.add_conditional_edges(
    "prepare_request",
    route_after_prepare,
    {
        "parse_location_query": "parse_location_query",
        "mark_for_review": "mark_for_review",
    },
)
builder.add_edge("parse_location_query", "call_precise_lookup")
builder.add_edge("call_precise_lookup", "diagnose_failure")
builder.add_conditional_edges(
    "diagnose_failure",
    route_after_diagnosis,
    {
        "select_recovered_result": "select_recovered_result",
        "retry_precise_lookup": "retry_precise_lookup",
        "call_general_area_lookup": "call_general_area_lookup",
        "mark_for_review": "mark_for_review",
    },
)
builder.add_edge("retry_precise_lookup", "call_precise_lookup")
builder.add_edge("call_general_area_lookup", "select_recovered_result")
builder.add_edge("select_recovered_result", "finalize_response")
builder.add_edge("mark_for_review", "finalize_response")
builder.add_edge("finalize_response", END)

graph = builder.compile()
