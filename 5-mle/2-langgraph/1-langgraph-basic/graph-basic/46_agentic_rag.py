"""
Example 46 — Agentic RAG capstone.

질문에 맞는 검색원을 선택하고, 검색 문서와 생성 답변을 각각 평가하며,
근거가 부족하면 검색을 보강해 다시 생성하는 자기교정 RAG 패턴입니다.

선행 예제
---------
- 05_conditional_routing: 조건부 라우팅
- 10_structured_output: 구조화된 분류와 평가
- 34_rag: retrieve → augment → generate
- 35_qa_pipeline: 답변 gate와 fallback
- 38_evaluator_loop: 평가 기반 재시도

새 개념
-------
- 질문을 local knowledge 또는 web search로 라우팅
- 검색 문서별 relevance 평가
- 생성 답변의 grounding과 usefulness를 분리 평가
- 실패 시 검색 보강과 재생성을 수행하는 bounded correction loop

그래프 구조
-----------
START ─▶ route ─┬─▶ retrieve ─▶ grade_documents ─┐
                 └─▶ web_search ──────────────────┤
                                                  ▼
                     END ◀─ grade_answer ◀─ generate
                                  └─▶ web_search (retry)
"""

from __future__ import annotations

import os
import re
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm

MAX_ATTEMPTS = 3


class RouteDecision(BaseModel):
    datasource: Literal["local", "web"] = Field(
        description="Use local for LangGraph concepts and web for current or unrelated facts."
    )


class RelevanceGrade(BaseModel):
    relevant: bool = Field(description="Whether the document helps answer the question.")


class AnswerGrade(BaseModel):
    grounded: bool = Field(description="Whether every factual claim is supported by the documents.")
    useful: bool = Field(description="Whether the answer directly resolves the question.")
    feedback: str = Field(description="A concise reason when either grade is false.")


class Document(TypedDict):
    id: str
    text: str
    source: str


class State(TypedDict, total=False):
    question: str
    datasource: Literal["local", "web"]
    documents: list[Document]
    answer: str
    grounded: bool
    useful: bool
    feedback: str
    attempts: int


LOCAL_DOCS: list[Document] = [
    {
        "id": "local-1",
        "source": "local",
        "text": "LangGraph represents long-running agent workflows as stateful graphs with nodes, edges, reducers, and cycles.",
    },
    {
        "id": "local-2",
        "source": "local",
        "text": "Checkpointers persist state by thread_id so interrupted LangGraph runs can resume and replay.",
    },
    {
        "id": "local-3",
        "source": "local",
        "text": "Human-in-the-loop workflows use interrupt and Command(resume=...) for review and approval.",
    },
]

DEMO_WEB_DOCS: list[Document] = [
    {
        "id": "web-1",
        "source": "demo-web",
        "text": "Web search is appropriate for current events or facts absent from the local knowledge base.",
    },
    {
        "id": "web-2",
        "source": "demo-web",
        "text": "Agentic RAG can add retrieved evidence, grade the answer, and retry with bounded attempts.",
    },
]

STOPWORDS = {"a", "an", "and", "for", "in", "is", "of", "the", "to", "what"}


def _terms(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[0-9a-zA-Z가-힣]+", text.lower())
        if len(token) >= 3 and token not in STOPWORDS
    }


def _keyword_search(query: str, documents: list[Document]) -> list[Document]:
    terms = _terms(query)
    ranked = sorted(
        documents,
        key=lambda item: sum(term in item["text"].lower() for term in terms),
        reverse=True,
    )
    return [
        item
        for item in ranked
        if any(term in item["text"].lower() for term in terms)
    ][:3]


def route_question(state: State) -> dict:
    router = create_llm().with_structured_output(RouteDecision)
    decision = router.invoke(
        [
            SystemMessage(
                content=(
                    "Route LangGraph, checkpoint, and HITL questions to local. "
                    "Route current events and unrelated facts to web."
                )
            ),
            HumanMessage(content=state["question"]),
        ]
    )
    return {"datasource": decision.datasource, "documents": [], "attempts": 0}


def route_to_datasource(state: State) -> str:
    return "web_search" if state.get("datasource") == "web" else "retrieve"


def retrieve(state: State) -> dict:
    return {"documents": _keyword_search(state["question"], LOCAL_DOCS)}


def grade_documents(state: State) -> dict:
    grader = create_llm().with_structured_output(RelevanceGrade)
    relevant: list[Document] = []
    for document in state.get("documents", []):
        grade = grader.invoke(
            [
                SystemMessage(content="Judge whether the document helps answer the question."),
                HumanMessage(
                    content=f"QUESTION:\n{state['question']}\n\nDOCUMENT:\n{document['text']}"
                ),
            ]
        )
        if grade.relevant:
            relevant.append(document)
    return {"documents": relevant}


def route_after_document_grade(state: State) -> str:
    return "generate" if state.get("documents") else "web_search"


def _demo_web_search(question: str) -> list[Document]:
    hits = _keyword_search(question, DEMO_WEB_DOCS)
    return hits or [
        {
            "id": "web-fallback",
            "source": "demo-web",
            "text": f"No live web result is configured for: {question}",
        }
    ]


def _tavily_documents(result: object) -> list[Document]:
    """Tavily 성공 응답만 내부 document 형식으로 변환한다.

    Tavily tool은 인증 실패를 예외 대신 ``{"error": ...}``로 반환할 수 있다.
    빈 결과와 error 응답은 여기서 빈 목록으로 정규화해 demo fallback이 동작하게 한다.
    """
    if isinstance(result, dict):
        items = result.get("results", [])
    elif isinstance(result, list):
        items = result
    else:
        items = []

    if not isinstance(items, list):
        return []

    documents: list[Document] = []
    for index, item in enumerate(items, 1):
        if not isinstance(item, dict) or not item.get("content"):
            continue
        documents.append(
            {
                "id": f"web-{index}",
                "source": str(item.get("url", "tavily")),
                "text": str(item["content"]),
            }
        )
    return documents


def web_search(state: State) -> dict:
    new_documents: list[Document]
    if os.environ.get("TAVILY_API_KEY"):
        try:
            from langchain_tavily import TavilySearch

            result = TavilySearch(max_results=3).invoke({"query": state["question"]})
            new_documents = _tavily_documents(result)
            if not new_documents:
                new_documents = _demo_web_search(state["question"])
        except Exception:
            new_documents = _demo_web_search(state["question"])
    else:
        new_documents = _demo_web_search(state["question"])

    by_id = {item["id"]: item for item in state.get("documents", [])}
    by_id.update({item["id"]: item for item in new_documents})
    return {"documents": list(by_id.values())}


def generate(state: State) -> dict:
    context = "\n\n".join(
        f"[{item['id']}] {item['text']}" for item in state.get("documents", [])
    )
    response = create_llm().invoke(
        [
            SystemMessage(
                content=(
                    "Answer using only the supplied documents and cite their ids. "
                    "If the evidence is insufficient, say so explicitly."
                )
            ),
            HumanMessage(content=f"QUESTION:\n{state['question']}\n\nDOCUMENTS:\n{context}"),
        ]
    )
    content = response.content
    if isinstance(content, list):
        content = " ".join(
            block.get("text", "") for block in content if isinstance(block, dict)
        )
    return {"answer": str(content), "attempts": state.get("attempts", 0) + 1}


def grade_answer(state: State) -> dict:
    grader = create_llm().with_structured_output(AnswerGrade)
    documents = "\n".join(item["text"] for item in state.get("documents", []))
    grade = grader.invoke(
        [
            SystemMessage(
                content="Separately grade grounding in the documents and usefulness to the question."
            ),
            HumanMessage(
                content=(
                    f"QUESTION:\n{state['question']}\n\n"
                    f"DOCUMENTS:\n{documents}\n\nANSWER:\n{state.get('answer', '')}"
                )
            ),
        ]
    )
    return {
        "grounded": grade.grounded,
        "useful": grade.useful,
        "feedback": grade.feedback,
    }


def route_after_answer_grade(state: State) -> str:
    passed = state.get("grounded") and state.get("useful")
    if passed or state.get("attempts", 0) >= MAX_ATTEMPTS:
        return "__end__"
    return "web_search"


def build_graph():
    builder = StateGraph(State)
    builder.add_node("route", route_question)
    builder.add_node("retrieve", retrieve)
    builder.add_node("grade_documents", grade_documents)
    builder.add_node("web_search", web_search)
    builder.add_node("generate", generate)
    builder.add_node("grade_answer", grade_answer)

    builder.add_edge(START, "route")
    builder.add_conditional_edges(
        "route",
        route_to_datasource,
        {"retrieve": "retrieve", "web_search": "web_search"},
    )
    builder.add_edge("retrieve", "grade_documents")
    builder.add_conditional_edges(
        "grade_documents",
        route_after_document_grade,
        {"generate": "generate", "web_search": "web_search"},
    )
    builder.add_edge("web_search", "generate")
    builder.add_edge("generate", "grade_answer")
    builder.add_conditional_edges(
        "grade_answer",
        route_after_answer_grade,
        {"web_search": "web_search", "__end__": END},
    )
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"question": "LangGraph checkpoint는 왜 필요한가요?"})
    print(output["answer"])
    print("grounded=", output["grounded"], "useful=", output["useful"])
