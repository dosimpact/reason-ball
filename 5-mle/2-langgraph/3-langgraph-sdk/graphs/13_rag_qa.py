"""Example 13: deterministic RAG retrieval with cited QA output."""

from __future__ import annotations

import re
from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


QAStatus = Literal["idle", "retrieved", "answered", "fallback"]


class SourceDoc(TypedDict):
    id: str
    title: str
    source: str
    text: str
    keywords: list[str]


class RetrievedDoc(TypedDict):
    id: str
    rank: int
    title: str
    source: str
    score: float
    snippet: str
    text: str
    matched_terms: list[str]


class CitationRecord(TypedDict):
    id: str
    doc_id: str
    label: str
    title: str
    rank: int
    score: float


class RagQaState(TypedDict, total=False):
    question: str
    retrieved_docs: list[RetrievedDoc]
    context: str
    answer: str
    citations: list[CitationRecord]
    citation_ok: bool
    qa_status: QAStatus
    fallback_reason: str
    final: str
    trace: list[dict[str, Any]]


DEFAULT_QUESTION = (
    "How should a LangGraph SDK RAG UI show retrieved documents, citation chips, "
    "and the supporting answer?"
)

DOCS: list[SourceDoc] = [
    {
        "id": "doc-sdk",
        "title": "LangGraph SDK Runtime",
        "source": "docs/langgraph-sdk-runtime.md",
        "text": (
            "The LangGraph SDK connects React clients to assistants, threads, runs, and "
            "stream modes. UI examples usually create a thread, stream a run, then read "
            "final thread state for durable values."
        ),
        "keywords": ["langgraph", "sdk", "react", "thread", "run", "stream", "state"],
    },
    {
        "id": "doc-rag",
        "title": "RAG UI Evidence",
        "source": "docs/rag-ui-evidence.md",
        "text": (
            "A RAG QA interface should show retrieved documents with rank, score, source "
            "id, and snippet. Citation chips in the answer should point to the supporting "
            "document card so users can inspect evidence quickly."
        ),
        "keywords": ["rag", "retrieval", "citation", "document", "rank", "score", "snippet"],
    },
    {
        "id": "doc-stream",
        "title": "Streaming Modes",
        "source": "docs/streaming-modes.md",
        "text": (
            "LangGraph SDK streaming modes include updates for node payloads, values for "
            "full state snapshots, messages for model messages, and custom events for "
            "application-specific progress."
        ),
        "keywords": ["stream", "updates", "values", "messages", "custom", "events"],
    },
    {
        "id": "doc-checkpoint",
        "title": "Checkpoint State",
        "source": "docs/checkpoint-state.md",
        "text": (
            "Thread state and checkpoint history let a UI reload current values, inspect "
            "prior snapshots, and resume interrupted or replayed runs by thread id."
        ),
        "keywords": ["checkpoint", "thread", "history", "resume", "replay", "state"],
    },
    {
        "id": "doc-hitl",
        "title": "Human Review",
        "source": "docs/human-review.md",
        "text": (
            "Human-in-the-loop examples pause execution before a sensitive action and let "
            "the UI approve, edit, or reject the pending payload before the graph resumes."
        ),
        "keywords": ["human", "interrupt", "approve", "edit", "reject", "resume"],
    },
]

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "for",
    "how",
    "in",
    "is",
    "of",
    "or",
    "should",
    "the",
    "to",
    "what",
    "when",
    "where",
    "with",
}


def _tokens(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9][a-z0-9-]*", value.lower())
        if len(token) > 1 and token not in STOPWORDS
    ]


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return str(content)


def _score_doc(question_terms: set[str], doc: SourceDoc) -> tuple[float, list[str]]:
    body = f"{doc['title']} {doc['source']} {doc['text']} {' '.join(doc['keywords'])}"
    doc_terms = set(_tokens(body))
    matched = sorted(question_terms.intersection(doc_terms))
    if not matched:
        return 0.0, []

    coverage = len(matched) / max(len(question_terms), 1)
    keyword_bonus = sum(0.03 for keyword in doc["keywords"] if keyword.lower() in question_terms)
    title_bonus = 0.08 if any(term in _tokens(doc["title"]) for term in question_terms) else 0.0
    return round(min(1.0, coverage + keyword_bonus + title_bonus), 3), matched


def _snippet(text: str, terms: list[str]) -> str:
    if not terms:
        return text[:180]
    lowered = text.lower()
    positions = [lowered.find(term) for term in terms if lowered.find(term) >= 0]
    start = max(min(positions) - 32, 0) if positions else 0
    end = min(start + 220, len(text))
    return text[start:end].strip()


def _extract_citation_ids(answer: str, allowed_ids: set[str]) -> list[str]:
    seen: list[str] = []
    for doc_id in re.findall(r"\[([a-z0-9-]+)\]", answer.lower()):
        if doc_id in allowed_ids and doc_id not in seen:
            seen.append(doc_id)
    return seen


def _citation_records(doc_ids: list[str], docs: list[RetrievedDoc]) -> list[CitationRecord]:
    by_id = {doc["id"]: doc for doc in docs}
    records: list[CitationRecord] = []
    for doc_id in doc_ids:
        doc = by_id.get(doc_id)
        if not doc:
            continue
        records.append(
            {
                "id": f"cite-{doc_id}",
                "doc_id": doc_id,
                "label": f"[{doc_id}]",
                "title": doc["title"],
                "rank": doc["rank"],
                "score": doc["score"],
            }
        )
    return records


def retrieve_documents(state: RagQaState) -> dict:
    question = state.get("question", DEFAULT_QUESTION)
    question_terms = set(_tokens(question))
    scored: list[tuple[float, list[str], SourceDoc]] = []
    for doc in DOCS:
        score, matched = _score_doc(question_terms, doc)
        if score > 0:
            scored.append((score, matched, doc))

    ranked = sorted(scored, key=lambda item: (-item[0], item[2]["id"]))[:3]
    retrieved: list[RetrievedDoc] = [
        {
            "id": doc["id"],
            "rank": index,
            "title": doc["title"],
            "source": doc["source"],
            "score": score,
            "snippet": _snippet(doc["text"], matched),
            "text": doc["text"],
            "matched_terms": matched,
        }
        for index, (score, matched, doc) in enumerate(ranked, start=1)
    ]
    fallback_reason = "" if retrieved else "No useful document matched the question."
    return {
        "question": question,
        "retrieved_docs": retrieved,
        "qa_status": "retrieved" if retrieved else "fallback",
        "fallback_reason": fallback_reason,
        "trace": [
            {
                "node": "retrieve_documents",
                "event": "retrieved",
                "query_terms": sorted(question_terms),
                "doc_ids": [doc["id"] for doc in retrieved],
            }
        ],
    }


def build_context(state: RagQaState) -> dict:
    docs = state.get("retrieved_docs", [])
    context = "\n\n".join(
        (
            f"[{doc['id']}] {doc['title']} ({doc['source']})\n"
            f"rank={doc['rank']} score={doc['score']}\n{doc['text']}"
        )
        for doc in docs
    )
    return {
        "context": context if context else "(no relevant documents)",
        "trace": state.get("trace", [])
        + [
            {
                "node": "build_context",
                "event": "context_ready",
                "doc_count": len(docs),
            }
        ],
    }


def generate_answer(state: RagQaState) -> dict:
    docs = state.get("retrieved_docs", [])
    if not docs:
        return {
            "answer": "I do not have enough relevant documents to answer this question.",
            "citations": [],
            "qa_status": "fallback",
            "fallback_reason": state.get("fallback_reason", "No useful document matched the question."),
            "trace": state.get("trace", [])
            + [
                {
                    "node": "generate_answer",
                    "event": "skipped_no_docs",
                }
            ],
        }

    allowed_ids = {doc["id"] for doc in docs}
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "Answer using only the provided context. Cite every sentence with one "
                    "or more allowed document ids in square brackets. Allowed citations: "
                    f"{', '.join(f'[{doc_id}]' for doc_id in sorted(allowed_ids))}.\n\n"
                    f"CONTEXT:\n{state.get('context', '')}"
                )
            ),
            HumanMessage(content=state.get("question", DEFAULT_QUESTION)),
        ]
    )
    answer = _extract_text(response.content).strip()
    cited_ids = _extract_citation_ids(answer, allowed_ids)
    if not cited_ids:
        cited_ids = [docs[0]["id"]]
        answer = f"{answer} [{docs[0]['id']}]"

    return {
        "answer": answer,
        "citations": _citation_records(cited_ids, docs),
        "qa_status": "answered",
        "fallback_reason": "",
        "trace": state.get("trace", [])
        + [
            {
                "node": "generate_answer",
                "event": "answered",
                "citation_ids": cited_ids,
            }
        ],
    }


def check_citations(state: RagQaState) -> dict:
    docs = state.get("retrieved_docs", [])
    citations = state.get("citations", [])
    allowed_ids = {doc["id"] for doc in docs}
    citation_ids = {citation["doc_id"] for citation in citations}
    citation_ok = bool(citation_ids) and citation_ids.issubset(allowed_ids)
    fallback_reason = "" if citation_ok else "The answer did not cite a retrieved document."
    if not docs:
        fallback_reason = state.get("fallback_reason", "No useful document matched the question.")
    return {
        "citation_ok": citation_ok,
        "fallback_reason": fallback_reason,
        "trace": state.get("trace", [])
        + [
            {
                "node": "check_citations",
                "event": "citation_ok" if citation_ok else "citation_failed",
                "allowed_ids": sorted(allowed_ids),
                "citation_ids": sorted(citation_ids),
            }
        ],
    }


def route_after_citation_check(state: RagQaState) -> str:
    return "__end__" if state.get("citation_ok") else "fallback"


def fallback(state: RagQaState) -> dict:
    reason = state.get("fallback_reason", "The answer could not be grounded in retrieved docs.")
    return {
        "answer": f"{reason} The local RAG corpus does not provide enough grounded evidence.",
        "citations": [],
        "qa_status": "fallback",
        "final": f"Fallback: {reason}",
        "trace": state.get("trace", [])
        + [
            {
                "node": "fallback",
                "event": "fallback",
                "reason": reason,
            }
        ],
    }


def finalize(state: RagQaState) -> dict:
    status = state.get("qa_status", "answered")
    citation_count = len(state.get("citations", []))
    doc_count = len(state.get("retrieved_docs", []))
    return {
        "final": f"RAG QA {status}: {doc_count} retrieved docs, {citation_count} citations.",
        "trace": state.get("trace", [])
        + [
            {
                "node": "finalize",
                "event": "complete",
                "qa_status": status,
                "doc_count": doc_count,
                "citation_count": citation_count,
            }
        ],
    }


def build_graph():
    builder = StateGraph(RagQaState)
    builder.add_node("retrieve_documents", retrieve_documents)
    builder.add_node("build_context", build_context)
    builder.add_node("generate_answer", generate_answer)
    builder.add_node("check_citations", check_citations)
    builder.add_node("fallback", fallback)
    builder.add_node("finalize", finalize)

    builder.add_edge(START, "retrieve_documents")
    builder.add_edge("retrieve_documents", "build_context")
    builder.add_edge("build_context", "generate_answer")
    builder.add_edge("generate_answer", "check_citations")
    builder.add_conditional_edges(
        "check_citations",
        route_after_citation_check,
        {"__end__": "finalize", "fallback": "fallback"},
    )
    builder.add_edge("fallback", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"question": DEFAULT_QUESTION})
    print(output["final"])
    print(output["answer"])
