"""chapter 02 routing — 그래프 입력 연습.

쉽게 이해하기
-------------
Routing은 요청의 종류에 따라 담당 작업을 고르는 것이다.
예: 주문 문의는 주문 처리로, 제품 문의는 제품 안내로 보낸다.
이 그래프는 분류 결과를 검증한 뒤 해당 handler를 실행한다.

그래프 구조
-----------
사용자 문의를 분류·검증한 뒤 주문·제품·기술지원·추가 확인 중 알맞은 경로로 보내 응답을 만든다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "Where is my order ORD-1001?"
}
```
관찰할 결과: route, route_confidence, handler_output, final_output에서 주문 조회 라우팅을 확인합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_02_routing.nodes import (
    clarification_handler,
    classify_route,
    format_response,
    order_status_handler,
    preprocess_input,
    product_info_handler,
    should_retry_router,
    technical_support_handler,
    validate_route,
)
from graphs.patterns.ch_02_routing.state import RoutingState


def route_after_preprocess(
    state: RoutingState,
) -> Literal["classify_route", "clarification_handler"]:
    if state.get("route") == "clarify":
        return "clarification_handler"
    return "classify_route"


def route_after_classify(
    state: RoutingState,
) -> Literal["classify_route", "validate_route"]:
    if should_retry_router(state):
        return "classify_route"
    return "validate_route"


def route_by_decision(
    state: RoutingState,
) -> Literal[
    "order_status_handler",
    "product_info_handler",
    "technical_support_handler",
    "clarification_handler",
]:
    route = state.get("route")
    if route == "order_status":
        return "order_status_handler"
    if route == "product_info":
        return "product_info_handler"
    if route == "technical_support":
        return "technical_support_handler"
    return "clarification_handler"


builder = StateGraph(RoutingState)
builder.add_node("preprocess_input", preprocess_input)
builder.add_node("classify_route", classify_route)
builder.add_node("validate_route", validate_route)
builder.add_node("order_status_handler", order_status_handler)
builder.add_node("product_info_handler", product_info_handler)
builder.add_node("technical_support_handler", technical_support_handler)
builder.add_node("clarification_handler", clarification_handler)
builder.add_node("format_response", format_response)

builder.add_edge(START, "preprocess_input")
builder.add_conditional_edges(
    "preprocess_input",
    route_after_preprocess,
    {
        "classify_route": "classify_route",
        "clarification_handler": "clarification_handler",
    },
)
builder.add_conditional_edges(
    "classify_route",
    route_after_classify,
    {
        "classify_route": "classify_route",
        "validate_route": "validate_route",
    },
)
builder.add_conditional_edges(
    "validate_route",
    route_by_decision,
    {
        "order_status_handler": "order_status_handler",
        "product_info_handler": "product_info_handler",
        "technical_support_handler": "technical_support_handler",
        "clarification_handler": "clarification_handler",
    },
)
builder.add_edge("order_status_handler", "format_response")
builder.add_edge("product_info_handler", "format_response")
builder.add_edge("technical_support_handler", "format_response")
builder.add_edge("clarification_handler", "format_response")
builder.add_edge("format_response", END)

graph = builder.compile()
