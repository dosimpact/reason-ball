"""문서 수집, 검색, 답변 생성을 묶은 문서 도우미 RAG 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects.project_06_documentation_helper.backend import run_llm


class DocumentationHelperState(TypedDict):
    query: NotRequired[str]
    answer: NotRequired[str]
    sources: NotRequired[list[str]]
    context_count: NotRequired[int]
    error: NotRequired[str]


DEFAULT_QUERY = "What are LangChain agents?"


def answer_docs_question_node(state: DocumentationHelperState) -> dict[str, Any]:
    try:
        result = run_llm(state.get("query") or DEFAULT_QUERY)
        context_docs = result.get("context", [])
        sources = [
            str(doc.metadata.get("source"))
            for doc in context_docs
            if getattr(doc, "metadata", None) and doc.metadata.get("source")
        ]
        return {
            "answer": str(result.get("answer", "")),
            "sources": sources,
            "context_count": len(context_docs),
            "error": "",
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(DocumentationHelperState)
builder.add_node("answer_docs_question", answer_docs_question_node)
builder.add_edge(START, "answer_docs_question")
builder.add_edge("answer_docs_question", END)

graph = builder.compile()

