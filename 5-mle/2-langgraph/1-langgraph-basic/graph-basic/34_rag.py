"""
Example 34 — RAG (Retrieval-Augmented Generation).

가장 흔한 LangGraph 사용 사례: 외부 문서를 검색해 LLM 에게 컨텍스트로 주입.
실 프로덕션은 vector DB(OpenSearch, Pinecone 등) 를 쓰지만 여기서는
**inmemory 키워드 매칭** 으로 단순화 (LangGraph 흐름 학습이 목적).

선행 예제
---------
- 08: 단일 LLM node
- 01: 직선 graph pipeline

새 개념
-------
- retrieve → augment → generate로 나눈 기본 RAG pipeline
- 검색 결과에 document id를 포함해 답변의 출처 표시로 사용

복습 개념
-------
- 노드별 partial state update와 직선 edge

그래프 구조
-----------
START ─▶ retrieve ─▶ augment ─▶ generate ─▶ END

테스트 입력 예시 (state.question: str)
-------------------------------------
인메모리 DOCS 키워드: "LangGraph", "Bedrock", "FastAPI", "Guardrails"

▶ 컨텍스트 매칭 → 인용 답변 (정상 케이스)
   - {"question": "Bedrock 의 Guardrail 은 무슨 역할을 하나요?"}     → [doc-4, doc-2] 후보
   - {"question": "What is LangGraph?"}                                → [doc-1]
   - {"question": "FastAPI 가 뭐야?"}                                  → [doc-3]
   - {"question": "Bedrock 에서 어떤 모델을 쓸 수 있어?"}              → [doc-2]

▶ 다중 문서 결합
   - {"question": "Bedrock 과 Guardrails 의 관계를 설명해줘"}          → [doc-4, doc-2]

▶ 컨텍스트 부족 → "정보 없음" 응답 확인
   - {"question": "쿠버네티스 파드가 뭐야?"}                            → "(no relevant documents)"
   - {"question": "오늘 점심 뭐 먹지?"}
"""

from __future__ import annotations

import re
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm

# ---------------------------------------------------------------------------
# 데모용 인메모리 "지식 베이스"
# ---------------------------------------------------------------------------
DOCS: list[dict[str, str]] = [
    {
        "id": "doc-1",
        "title": "LangGraph",
        "text": "LangGraph is a library for building stateful, multi-actor applications "
        "with LLMs. It extends LangChain with cyclic graph support.",
    },
    {
        "id": "doc-2",
        "title": "AWS Bedrock",
        "text": "Amazon Bedrock is a fully managed service that offers foundation models "
        "from leading AI companies (Anthropic, Meta, Cohere, Mistral) via a single API.",
    },
    {
        "id": "doc-3",
        "title": "FastAPI",
        "text": "FastAPI is a modern Python web framework based on type hints, with built-in "
        "OpenAPI/Swagger documentation and async support.",
    },
    {
        "id": "doc-4",
        "title": "Guardrails",
        "text": "Bedrock Guardrails apply content filtering, PII masking, and prompt-injection "
        "detection on inputs and outputs of foundation models.",
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
    """Stopword/1~2글자 토큰을 제외해 짧은 공통 단어 오탐을 막는다."""
    tokens = re.findall(r"[0-9a-zA-Z가-힣]+", question.lower())
    return [token for token in tokens if len(token) >= 3 and token not in STOPWORDS]


class State(TypedDict, total=False):
    question: str
    docs: list[dict[str, str]]
    context: str
    answer: str


def retrieve(state: State) -> dict:
    """매우 단순한 키워드 기반 검색 (top-k=3)."""
    keywords = _search_terms(state["question"])

    def score(doc: dict) -> int:
        body = (doc["title"] + " " + doc["text"]).lower()
        return sum(1 for keyword in keywords if keyword in body)

    ranked = sorted(DOCS, key=score, reverse=True)
    hits = [d for d in ranked if score(d) > 0][:3]
    return {"docs": hits}


def augment(state: State) -> dict:
    """검색된 문서를 system prompt 용 컨텍스트 문자열로 결합."""
    parts = [f"[{d['id']} | {d['title']}]\n{d['text']}" for d in state.get("docs", [])]
    return {"context": "\n\n".join(parts) if parts else "(no relevant documents)"}


def generate(state: State) -> dict:
    """컨텍스트 + 질문을 LLM 에 주고 답변 생성."""
    llm = create_llm()
    system = SystemMessage(
        content=(
            "Answer the user question using ONLY the provided context. "
            "If the context is insufficient, say so explicitly. "
            "Cite document ids you used in square brackets, e.g. [doc-1].\n\n"
            f"Context:\n{state.get('context', '')}"
        )
    )
    response = llm.invoke([system, HumanMessage(content=state["question"])])
    content = response.content
    if isinstance(content, list):
        content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
    return {"answer": str(content)}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("retrieve", retrieve)
    builder.add_node("augment", augment)
    builder.add_node("generate", generate)

    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "augment")
    builder.add_edge("augment", "generate")
    builder.add_edge("generate", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke({"question": "Bedrock 의 Guardrail 은 무슨 역할을 하나요?"})
    print("DOCS:", [d["id"] for d in out["docs"]])
    print("ANSWER:", out["answer"])
