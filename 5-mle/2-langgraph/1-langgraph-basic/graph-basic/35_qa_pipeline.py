"""
Example 35 — RAG QA pipeline.

RAG 답변을 한 번 생성하고 끝내지 않고,
retrieve → answer → cite_check → fallback 의 QA 파이프라인으로 구성하는 패턴.

`cite_check`는 **검색된 문서 ID가 답변에 최소 하나 있는지**를
결정적으로 검사합니다. 각 문장의 사실성이나 모든 주장의 인용 충족을
검증하는 완전한 factuality checker는 아닙니다.

선행 예제
---------
- 34: retrieve → augment → generate RAG pipeline
- 05: conditional routing

새 개념
-------
- 최소 citation-presence gate와 실패 시 결정적 fallback

복습 개념
-------
- RAG state와 conditional edge

그래프 구조
-----------
START ─▶ retrieve ─▶ answer ─▶ cite_check ─┬─▶ END
                                            └─▶ fallback ─▶ END

테스트 입력 예시
---------------
▶ 정상 답변
   - {"question": "LangGraph 에서 checkpoint 는 왜 쓰나요?"}
   - {"question": "HITL 은 어떤 상황에 필요한가요?"}
▶ fallback
   - {"question": "쿠버네티스 파드는 무엇인가요?"}
"""

from __future__ import annotations

import re
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm

DOCS = [
    {
        "id": "qa-1",
        "title": "LangGraph",
        "text": "LangGraph models agent workflows as stateful graphs with nodes, edges, cycles, and reducers.",
    },
    {
        "id": "qa-2",
        "title": "Checkpoint",
        "text": "Checkpointers persist graph state by thread_id so conversations and interrupted runs can resume.",
    },
    {
        "id": "qa-3",
        "title": "HITL",
        "text": "Human-in-the-loop flows pause execution for review, approval, editing, or rejection before continuing.",
    },
]

STOPWORDS = {
    "a",
    "an",
    "and",
    "for",
    "in",
    "is",
    "of",
    "or",
    "the",
    "to",
    "what",
    "뭐야",
    "무엇",
    "무엇인가요",
}


def _search_terms(question: str) -> list[str]:
    tokens = re.findall(r"[0-9a-zA-Z가-힣]+", question.lower())
    return [token for token in tokens if len(token) >= 3 and token not in STOPWORDS]


class State(TypedDict, total=False):
    question: str
    docs: list[dict[str, str]]
    answer: str
    citation_ok: bool
    qa_status: str


def _text(content) -> str:
    if isinstance(content, list):
        return " ".join(b.get("text", "") for b in content if isinstance(b, dict))
    return str(content)


def retrieve(state: State) -> dict:
    terms = _search_terms(state["question"])
    hits = [
        doc
        for doc in DOCS
        if any(term in (doc["title"] + " " + doc["text"]).lower() for term in terms)
    ]
    return {"docs": hits[:2]}


def answer(state: State) -> dict:
    docs = state.get("docs", [])
    if not docs:
        return {"answer": "(no answer)", "qa_status": "no_docs"}

    context = "\n\n".join(f"[{d['id']}] {d['text']}" for d in docs)
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Answer using only the context. Include the relevant document id "
                    "like [qa-1]. If context is insufficient, say so."
                    f"\n\nCONTEXT:\n{context}"
                )
            ),
            HumanMessage(content=state["question"]),
        ]
    )
    return {"answer": _text(response.content), "qa_status": "answered"}


def cite_check(state: State) -> dict:
    docs = state.get("docs", [])
    answer_text = state.get("answer", "")
    if not docs:
        return {"citation_ok": False}
    allowed_ids = {f"[{doc['id']}]" for doc in docs}
    return {"citation_ok": any(doc_id in answer_text for doc_id in allowed_ids)}


def fallback(state: State) -> dict:
    if not state.get("docs"):
        reason = "관련 문서를 찾지 못했습니다."
    else:
        reason = "답변에 필요한 인용이 없어 신뢰할 수 없습니다."
    return {
        "answer": f"{reason} 현재 지식 베이스 범위 안에서는 답변하지 않겠습니다.",
        "qa_status": "fallback",
    }


def route_after_cite_check(state: State) -> str:
    return "__end__" if state.get("citation_ok") else "fallback"


def build_graph():
    builder = StateGraph(State)
    builder.add_node("retrieve", retrieve)
    builder.add_node("answer", answer)
    builder.add_node("cite_check", cite_check)
    builder.add_node("fallback", fallback)

    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "answer")
    builder.add_edge("answer", "cite_check")
    builder.add_conditional_edges(
        "cite_check",
        route_after_cite_check,
        {"fallback": "fallback", "__end__": END},
    )
    builder.add_edge("fallback", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke({"question": "LangGraph 에서 checkpoint 는 왜 쓰나요?"})
    print(out["qa_status"], "citation_ok=", out["citation_ok"])
    print(out["answer"])
