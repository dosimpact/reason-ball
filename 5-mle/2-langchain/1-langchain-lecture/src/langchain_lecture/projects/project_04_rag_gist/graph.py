"""문서 검색 결과를 프롬프트에 넣어 답변하는 RAG 기본 흐름 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects.project_04_rag_gist.chain import (
    build_lcel_retrieval_chain,
    build_pinecone_retriever,
)


class RagGistState(TypedDict):
    question: NotRequired[str]
    answer: NotRequired[str]
    error: NotRequired[str]


DEFAULT_QUESTION = "What is Pinecone in machine learning?"


def answer_with_rag_node(state: RagGistState) -> dict[str, str]:
    try:
        retriever = build_pinecone_retriever()
        chain = build_lcel_retrieval_chain(retriever)
        answer = chain.invoke({"question": state.get("question") or DEFAULT_QUESTION})
        return {"answer": answer, "error": ""}
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(RagGistState)
builder.add_node("answer_with_rag", answer_with_rag_node)
builder.add_edge(START, "answer_with_rag")
builder.add_edge("answer_with_rag", END)

graph = builder.compile()

