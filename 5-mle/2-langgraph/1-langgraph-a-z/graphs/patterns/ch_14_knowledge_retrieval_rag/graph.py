"""chapter 14 knowledge retrieval rag — 그래프 입력 연습.

쉽게 이해하기
-------------
RAG는 질문에 필요한 자료를 먼저 찾아 모델의 답변에 참고시키는 방법이다.
예: 문서에서 관련 내용을 골라 답변과 출처를 만든다.
이 그래프는 검색 자료가 충분한지와 답변에 근거가 있는지도 검사한다.

그래프 구조
-----------
문서를 검색·정렬해 근거를 확보하고, 필요하면 질문이나 검색 범위를 보완해 근거 검증을 거친 답변을 만든다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "input": "What is LangGraph checkpointing?",
  "retrieval_strategy": "hybrid"
}
```
관찰할 결과: retrieved_chunks, context_quality, citations, grounding_status, final_output을 확인합니다. 기본 corpus와 검색 설정을 사용합니다.

실행 조건·방법:
구조화된 결과의 내용·경로는 모델과 평가 결과에 따라 달라질 수 있습니다. 실제 모델 경로는 루트 .env의 provider/API 키와 선택한 도구·저장소 설정이 필요합니다.
"""

from __future__ import annotations

from typing import Literal

from langgraph.graph import END, START, StateGraph

from graphs.patterns.ch_14_knowledge_retrieval_rag.nodes import (
    assess_context_quality,
    build_augmented_prompt,
    expand_related_context,
    finalize_answer,
    finalize_failure,
    finalize_insufficient_context,
    generate_answer,
    prepare_corpus_index,
    prepare_query,
    rank_and_filter_context,
    retrieve_candidates,
    rewrite_query,
    validate_grounding,
)
from graphs.patterns.ch_14_knowledge_retrieval_rag.state import (
    KnowledgeRetrievalRAGState,
)


def route_after_prepare(
    state: KnowledgeRetrievalRAGState,
) -> Literal["prepare_corpus_index", "finalize_failure"]:
    if state.get("status") == "failed":
        return "finalize_failure"
    return "prepare_corpus_index"


def route_after_index(
    state: KnowledgeRetrievalRAGState,
) -> Literal["retrieve_candidates", "finalize_failure"]:
    if state.get("status") == "failed":
        return "finalize_failure"
    return "retrieve_candidates"


def route_after_retrieval(
    state: KnowledgeRetrievalRAGState,
) -> Literal["rank_and_filter_context", "finalize_failure"]:
    if state.get("status") == "failed":
        return "finalize_failure"
    return "rank_and_filter_context"


def route_after_context_assessment(
    state: KnowledgeRetrievalRAGState,
) -> Literal[
    "build_augmented_prompt",
    "expand_related_context",
    "rewrite_query",
    "finalize_insufficient_context",
]:
    quality = state.get("context_quality")
    if quality == "sufficient":
        return "build_augmented_prompt"
    if quality == "fragmented":
        return "expand_related_context"
    if quality in {"weak", "missing"} and _has_retrieval_attempt_remaining(state):
        return "rewrite_query"
    return "finalize_insufficient_context"


def route_after_generation(
    state: KnowledgeRetrievalRAGState,
) -> Literal["validate_grounding", "finalize_failure"]:
    if state.get("status") == "failed":
        return "finalize_failure"
    return "validate_grounding"


def route_after_grounding(
    state: KnowledgeRetrievalRAGState,
) -> Literal["finalize_answer", "rewrite_query", "finalize_insufficient_context", "finalize_failure"]:
    if state.get("grounding_status") == "failed" or state.get("status") == "failed":
        return "finalize_failure"
    if state.get("grounding_status") == "grounded":
        return "finalize_answer"
    if _has_retrieval_attempt_remaining(state):
        return "rewrite_query"
    return "finalize_insufficient_context"


def _has_retrieval_attempt_remaining(state: KnowledgeRetrievalRAGState) -> bool:
    config = state.get("retrieval_config", {})
    max_attempts = config.get("max_retrieval_attempts", 2)
    try:
        max_attempts_int = max(1, int(max_attempts))
    except (TypeError, ValueError):
        max_attempts_int = 2
    return state.get("retrieval_attempts", 0) < max_attempts_int


builder = StateGraph(KnowledgeRetrievalRAGState)
builder.add_node("prepare_query", prepare_query)
builder.add_node("prepare_corpus_index", prepare_corpus_index)
builder.add_node("retrieve_candidates", retrieve_candidates)
builder.add_node("rank_and_filter_context", rank_and_filter_context)
builder.add_node("assess_context_quality", assess_context_quality)
builder.add_node("expand_related_context", expand_related_context)
builder.add_node("rewrite_query", rewrite_query)
builder.add_node("build_augmented_prompt", build_augmented_prompt)
builder.add_node("generate_answer", generate_answer)
builder.add_node("validate_grounding", validate_grounding)
builder.add_node("finalize_answer", finalize_answer)
builder.add_node("finalize_insufficient_context", finalize_insufficient_context)
builder.add_node("finalize_failure", finalize_failure)

builder.add_edge(START, "prepare_query")
builder.add_conditional_edges(
    "prepare_query",
    route_after_prepare,
    {
        "prepare_corpus_index": "prepare_corpus_index",
        "finalize_failure": "finalize_failure",
    },
)
builder.add_conditional_edges(
    "prepare_corpus_index",
    route_after_index,
    {
        "retrieve_candidates": "retrieve_candidates",
        "finalize_failure": "finalize_failure",
    },
)
builder.add_conditional_edges(
    "retrieve_candidates",
    route_after_retrieval,
    {
        "rank_and_filter_context": "rank_and_filter_context",
        "finalize_failure": "finalize_failure",
    },
)
builder.add_edge("rank_and_filter_context", "assess_context_quality")
builder.add_conditional_edges(
    "assess_context_quality",
    route_after_context_assessment,
    {
        "build_augmented_prompt": "build_augmented_prompt",
        "expand_related_context": "expand_related_context",
        "rewrite_query": "rewrite_query",
        "finalize_insufficient_context": "finalize_insufficient_context",
    },
)
builder.add_edge("expand_related_context", "build_augmented_prompt")
builder.add_edge("rewrite_query", "retrieve_candidates")
builder.add_edge("build_augmented_prompt", "generate_answer")
builder.add_conditional_edges(
    "generate_answer",
    route_after_generation,
    {
        "validate_grounding": "validate_grounding",
        "finalize_failure": "finalize_failure",
    },
)
builder.add_conditional_edges(
    "validate_grounding",
    route_after_grounding,
    {
        "finalize_answer": "finalize_answer",
        "rewrite_query": "rewrite_query",
        "finalize_insufficient_context": "finalize_insufficient_context",
        "finalize_failure": "finalize_failure",
    },
)
builder.add_edge("finalize_answer", END)
builder.add_edge("finalize_insufficient_context", END)
builder.add_edge("finalize_failure", END)

graph = builder.compile()
