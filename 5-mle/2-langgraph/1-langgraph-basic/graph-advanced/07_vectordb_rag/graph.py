"""
07 — Qdrant + BM25 하이브리드 RAG.

부모 `graph-basic/34_rag.py` 의 인메모리 키워드 매칭을 실전 패턴으로 업그레이드.

핵심 메커니즘
-------------
- Dense: Qdrant + Bedrock Titan embedding (semantic)
- Sparse: rank_bm25 (keyword)
- 결합: RRF (Reciprocal Rank Fusion)
- LLM-based light rerank (top-k 만 점수화)
- 인용 ID 강제 + "정보 없음" fallback

그래프 구조
-----------
START ─▶ retrieve(hybrid) ─▶ rerank ─▶ augment ─▶ generate ─▶ END

테스트 입력 (state.question)
---------------------------
인덱싱된 토픽: LangGraph, Bedrock, FastAPI, Guardrails, Qdrant, BM25, RRF, RAG, 임베딩, 청킹
1) "LangGraph 가 뭐야?"
2) "Bedrock Guardrails 의 역할은?"
3) "BM25 와 dense retrieval 차이?"
4) "RRF 가 어떻게 두 결과를 합쳐?"
5) "쿠버네티스 파드란?"   ← 컨텍스트 부족 → 모른다고 답해야 정상
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import TypedDict

sys.path.insert(0, str(Path(__file__).resolve().parent))

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm
from retriever import HybridRetriever


class State(TypedDict, total=False):
    question: str
    candidates: list[dict]   # hybrid 결과 (top N)
    docs: list[dict]         # rerank 후 top K
    context: str
    answer: str


_retriever: HybridRetriever | None = None


def _get_retriever() -> HybridRetriever:
    global _retriever
    if _retriever is None:
        _retriever = HybridRetriever(
            qdrant_url=os.environ.get("QDRANT_URL", "http://localhost:6333"),
            collection=os.environ.get("QDRANT_COLLECTION", "langgraph_advanced"),
        )
    return _retriever


def retrieve(state: State) -> dict:
    """Dense (Qdrant) + Sparse (BM25) → RRF 결합."""
    hits = _get_retriever().hybrid_search(state["question"], top_k=8)
    return {"candidates": hits}


def rerank(state: State) -> dict:
    """LLM 기반 경량 점수화 (0~10) 로 top-3 추림.

    실전에서는 cross-encoder (bge-reranker, Cohere Rerank) 권장.
    여기서는 외부 의존성을 줄이기 위해 default 한 번 호출.
    """
    cands = state.get("candidates", [])
    if not cands:
        return {"docs": []}

    llm = create_llm()
    listing = "\n".join(f"[{i}] {c['title']}: {c['text'][:200]}" for i, c in enumerate(cands))
    prompt = (
        "Score each document 0-10 for relevance to the question. "
        "Output ONLY space-separated integers in order, e.g. '7 3 9 0 ...'.\n\n"
        f"Question: {state['question']}\n\nDocuments:\n{listing}"
    )
    resp = llm.invoke([HumanMessage(content=prompt)])
    raw = resp.content if isinstance(resp.content, str) else " ".join(
        b.get("text", "") for b in resp.content if isinstance(b, dict)
    )
    scores: list[int] = []
    for tok in raw.replace(",", " ").split():
        try:
            scores.append(int(tok))
        except ValueError:
            continue
    # 길이 보정
    while len(scores) < len(cands):
        scores.append(0)
    ranked = sorted(zip(scores, cands), key=lambda x: x[0], reverse=True)
    docs = [c for s, c in ranked if s >= 3][:3]
    return {"docs": docs}


def augment(state: State) -> dict:
    docs = state.get("docs", [])
    if not docs:
        return {"context": "(no relevant documents)"}
    parts = [f"[{d['id']} | {d['title']}]\n{d['text']}" for d in docs]
    return {"context": "\n\n".join(parts)}


def generate(state: State) -> dict:
    llm = create_llm()
    system = SystemMessage(
        content=(
            "Answer the user question using ONLY the provided context. "
            "If the context is insufficient, say so explicitly in Korean. "
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
    b = StateGraph(State)
    b.add_node("retrieve", retrieve)
    b.add_node("rerank", rerank)
    b.add_node("augment", augment)
    b.add_node("generate", generate)
    b.add_edge(START, "retrieve")
    b.add_edge("retrieve", "rerank")
    b.add_edge("rerank", "augment")
    b.add_edge("augment", "generate")
    b.add_edge("generate", END)
    return b.compile()


graph = build_graph()


if __name__ == "__main__":
    questions = [
        "LangGraph 가 뭐야?",
        "Bedrock Guardrails 의 역할은?",
        "BM25 와 dense retrieval 차이?",
        "RRF 가 어떻게 두 결과를 합쳐?",
        "쿠버네티스 파드란?",
    ]
    for q in questions:
        out = graph.invoke({"question": q})
        ids = [d["id"] for d in out.get("docs", [])]
        print(f"\n=== Q: {q}")
        print(f"DOCS: {ids}")
        print(f"ANSWER: {out['answer']}")
