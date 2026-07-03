"""청킹, 검색기 조합, 평가를 포함한 고급 RAG 검색 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.rag_chain import (
    RetrievalRagChain,
)
from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.retrievers import (
    RetrievalStrategy,
)


class AdvancedRagState(TypedDict):
    question: NotRequired[str]
    strategy: NotRequired[RetrievalStrategy]
    answer: NotRequired[str]
    sources: NotRequired[list[str]]
    valid: NotRequired[bool]
    error: NotRequired[str]


DEFAULT_QUESTION = "챗봇 응답이 느려질 때 어떤 운영 지표를 확인해야 하나요?"


def answer_with_advanced_rag_node(state: AdvancedRagState) -> dict[str, object]:
    try:
        chain = RetrievalRagChain(strategy=state.get("strategy", "rerank"))
        response = chain.invoke(
            {
                "question": state.get("question", DEFAULT_QUESTION),
                "strategy": state.get("strategy", "rerank"),
            }
        )
        return {
            "answer": response.answer,
            "sources": response.sources,
            "valid": response.validation.valid,
            "error": "",
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(AdvancedRagState)
builder.add_node("answer_with_advanced_rag", answer_with_advanced_rag_node)
builder.add_edge(START, "answer_with_advanced_rag")
builder.add_edge("answer_with_advanced_rag", END)

graph = builder.compile()
