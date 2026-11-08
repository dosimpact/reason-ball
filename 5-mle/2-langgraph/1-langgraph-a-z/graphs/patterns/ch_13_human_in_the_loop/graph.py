"""chapter 13 human in the loop — 그래프 입력 연습.

쉽게 이해하기
-------------
Human-in-the-loop는 자동 처리를 잠시 멈추고 사람의 판단을 받는 방식이다.
예: 해결하기 어려운 고객 문의를 담당자가 검토한다.
검토 필요 여부를 판단하고, 사람에게 보여줄 정보를 정리한 뒤 결정을 반영한다.

그래프 구조
-----------
고객 요청을 분석해 해결안을 만들고, 필요하면 검토용 정보를 정리해 사람의 결정을 받은 뒤 처리 결과를 기록한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "I need help with a billing issue.",
  "customer_id": "input-demo-customer"
}
```
관찰할 결과: risk_level, needs_human_review, redacted_review_request, review_status와 final_output을 확인합니다. 사람 응답이 없으면 awaiting_human 상태로 종료하며 review_interrupt에 재입력 안내를 남깁니다.
후속 호출은 human_response 필드로 결정을 전달합니다. 이 패턴의 review_interrupt는 LangGraph interrupt()/Command 재개와 다릅니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_13_human_in_the_loop.nodes import (
    apply_human_decision,
    assess_handoff_need,
    build_agent_recommendation,
    classify_request,
    create_ticket,
    finalize,
    load_customer_context,
    preprocess_input,
    record_review_outcome,
    redact_review_payload,
    request_human_review,
    troubleshoot_issue,
)
from graphs.patterns.ch_13_human_in_the_loop.state import (
    HumanInTheLoopState,
)


def route_after_preprocess(
    state: HumanInTheLoopState,
) -> Literal["load_customer_context", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "load_customer_context"


def route_after_assessment(
    state: HumanInTheLoopState,
) -> Literal["redact_review_payload", "create_ticket", "finalize"]:
    if state.get("needs_human_review", False):
        return "redact_review_payload"
    troubleshooting_result = state.get("troubleshooting_result") or {}
    recommendation = state.get("agent_recommendation") or {}
    if (
        troubleshooting_result.get("requires_follow_up")
        or recommendation.get("recommended_action") == "create_ticket"
    ):
        return "create_ticket"
    return "finalize"


def route_after_ticket(
    state: HumanInTheLoopState,
) -> Literal["redact_review_payload", "finalize"]:
    if state.get("needs_human_review", False):
        return "redact_review_payload"
    return "finalize"


def route_after_redaction(
    state: HumanInTheLoopState,
) -> Literal["request_human_review", "finalize"]:
    if state.get("review_status") == "review_unavailable":
        return "finalize"
    return "request_human_review"


def route_after_review_request(
    state: HumanInTheLoopState,
) -> Literal["apply_human_decision", "finalize"]:
    if state.get("human_response"):
        return "apply_human_decision"
    return "finalize"


builder = StateGraph(HumanInTheLoopState)
builder.add_node("preprocess_input", preprocess_input)
builder.add_node("load_customer_context", load_customer_context)
builder.add_node("classify_request", classify_request)
builder.add_node("troubleshoot_issue", troubleshoot_issue)
builder.add_node("build_agent_recommendation", build_agent_recommendation)
builder.add_node("assess_handoff_need", assess_handoff_need)
builder.add_node("create_ticket", create_ticket)
builder.add_node("redact_review_payload", redact_review_payload)
builder.add_node("request_human_review", request_human_review)
builder.add_node("apply_human_decision", apply_human_decision)
builder.add_node("record_review_outcome", record_review_outcome)
builder.add_node("finalize", finalize)

builder.add_edge(START, "preprocess_input")
builder.add_conditional_edges(
    "preprocess_input",
    route_after_preprocess,
    {
        "load_customer_context": "load_customer_context",
        "finalize": "finalize",
    },
)
builder.add_edge("load_customer_context", "classify_request")
builder.add_edge("classify_request", "troubleshoot_issue")
builder.add_edge("troubleshoot_issue", "build_agent_recommendation")
builder.add_edge("build_agent_recommendation", "assess_handoff_need")
builder.add_conditional_edges(
    "assess_handoff_need",
    route_after_assessment,
    {
        "redact_review_payload": "redact_review_payload",
        "create_ticket": "create_ticket",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "create_ticket",
    route_after_ticket,
    {
        "redact_review_payload": "redact_review_payload",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "redact_review_payload",
    route_after_redaction,
    {
        "request_human_review": "request_human_review",
        "finalize": "finalize",
    },
)
builder.add_conditional_edges(
    "request_human_review",
    route_after_review_request,
    {
        "apply_human_decision": "apply_human_decision",
        "finalize": "finalize",
    },
)
builder.add_edge("apply_human_decision", "record_review_outcome")
builder.add_edge("record_review_outcome", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
