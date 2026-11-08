"""chapter 08 memory management — 그래프 입력 연습.

쉽게 이해하기
-------------
Memory management는 현재 대화와 다시 사용할 정보를 골라 보관하는 것이다.
예: 대화는 짧게 정리하고 사용자의 선호는 다음 대화에도 참고한다.
이 그래프는 기억 조회 → 답변 생성 → 새 기억 후보 검증·저장을 나눠 처리한다.

그래프 구조
-----------
장기 기억을 조회하고 짧게 정리한 대화와 함께 답변을 생성한 뒤, 새 기억 후보를 검증해 저장한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "I prefer concise Korean explanations.",
  "user_id": "input-demo-user",
  "thread_id": "input-demo-thread"
}
```
관찰할 결과: retrieved_memories, memory_candidates, approved_memory_updates, memory_write_results와 final_output을 확인합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
기억 저장 adapter가 지속성을 결정합니다. 테스트용 user_id를 쓰고 실제 사용자 기억과 분리합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.store.memory import InMemoryStore

from graphs.patterns.ch_08_memory_management.nodes import (
    build_prompt_context,
    build_retrieval_query,
    compact_short_term_memory,
    extract_memory_candidates,
    finalize,
    generate_response,
    mark_needs_review,
    prepare_turn,
    retrieve_long_term_memory,
    store_memory_updates,
    validate_memory_updates,
)
from graphs.patterns.ch_08_memory_management.state import (
    MemoryManagementState,
)


def route_after_prepare(
    state: MemoryManagementState,
) -> Literal["build_retrieval_query", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "build_retrieval_query"


def route_after_retrieval(
    state: MemoryManagementState,
) -> Literal["compact_short_term_memory", "mark_needs_review"]:
    if state.get("status") == "needs_review":
        return "mark_needs_review"
    return "compact_short_term_memory"


def route_after_generation(
    state: MemoryManagementState,
) -> Literal["extract_memory_candidates", "finalize"]:
    if state.get("status") == "failed":
        return "finalize"
    return "extract_memory_candidates"


def route_after_validation(
    state: MemoryManagementState,
) -> Literal["store_memory_updates", "finalize", "mark_needs_review"]:
    if state.get("status") == "needs_review":
        return "mark_needs_review"
    if state.get("approved_memory_updates"):
        return "store_memory_updates"
    return "finalize"


builder = StateGraph(MemoryManagementState)
builder.add_node("prepare_turn", prepare_turn)
builder.add_node("build_retrieval_query", build_retrieval_query)
builder.add_node("retrieve_long_term_memory", retrieve_long_term_memory)
builder.add_node("compact_short_term_memory", compact_short_term_memory)
builder.add_node("build_prompt_context", build_prompt_context)
builder.add_node("generate_response", generate_response)
builder.add_node("extract_memory_candidates", extract_memory_candidates)
builder.add_node("validate_memory_updates", validate_memory_updates)
builder.add_node("store_memory_updates", store_memory_updates)
builder.add_node("finalize", finalize)
builder.add_node("mark_needs_review", mark_needs_review)

builder.add_edge(START, "prepare_turn")
builder.add_conditional_edges(
    "prepare_turn",
    route_after_prepare,
    {
        "build_retrieval_query": "build_retrieval_query",
        "finalize": "finalize",
    },
)
builder.add_edge("build_retrieval_query", "retrieve_long_term_memory")
builder.add_conditional_edges(
    "retrieve_long_term_memory",
    route_after_retrieval,
    {
        "compact_short_term_memory": "compact_short_term_memory",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("compact_short_term_memory", "build_prompt_context")
builder.add_edge("build_prompt_context", "generate_response")
builder.add_conditional_edges(
    "generate_response",
    route_after_generation,
    {
        "extract_memory_candidates": "extract_memory_candidates",
        "finalize": "finalize",
    },
)
builder.add_edge("extract_memory_candidates", "validate_memory_updates")
builder.add_conditional_edges(
    "validate_memory_updates",
    route_after_validation,
    {
        "store_memory_updates": "store_memory_updates",
        "finalize": "finalize",
        "mark_needs_review": "mark_needs_review",
    },
)
builder.add_edge("store_memory_updates", "finalize")
builder.add_edge("finalize", END)
builder.add_edge("mark_needs_review", END)

graph = builder.compile()

test_graph = builder.compile(
    checkpointer=InMemorySaver(),
    store=InMemoryStore(),
)
