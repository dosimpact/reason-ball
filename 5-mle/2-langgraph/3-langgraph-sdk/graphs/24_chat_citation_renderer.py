"""Example 24: chat answer renderer with inline citation metadata."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


FinalStatus = Literal["running", "completed", "fallback"]


class SourceDoc(TypedDict):
    id: str
    title: str
    url: str
    source_type: str
    text: str
    keywords: list[str]


class RetrievedSource(TypedDict):
    id: str
    rank: int
    title: str
    url: str
    source_type: str
    score: float
    snippet: str
    text: str
    matched_terms: list[str]


class AnswerSegment(TypedDict):
    id: str
    text: str
    citation_ids: list[str]


class Citation(TypedDict):
    id: str
    label: str
    source_id: str
    segment_id: str
    title: str
    url: str
    snippet: str
    rank: int
    score: float


class CitationEvent(TypedDict):
    type: str
    schema_version: str
    phase: str
    status: str
    detail: str
    source_id: str
    citation_id: str
    timestamp: str


class ChatCitationState(TypedDict, total=False):
    question: str
    renderer_status: str
    sources: list[RetrievedSource]
    retrieved_docs: list[RetrievedSource]
    answer_segments: list[AnswerSegment]
    citations: list[Citation]
    citation_events: Annotated[list[CitationEvent], add]
    citation_ok: bool
    answer_text: str
    answer: str
    final: str
    final_status: FinalStatus


DEFAULT_QUESTION = (
    "How should a chat UI render inline citation chips, hover previews, and source document cards?"
)

DOCS: list[SourceDoc] = [
    {
        "id": "doc-rag",
        "title": "RAG Citation UX",
        "url": "https://docs.example.local/rag-citation-ux",
        "source_type": "guide",
        "text": (
            "A RAG answer should keep citation metadata separate from answer text. Inline citation "
            "chips can open a preview and highlight the matching source document card."
        ),
        "keywords": ["rag", "citation", "inline", "chip", "preview", "source", "document"],
    },
    {
        "id": "doc-sdk",
        "title": "LangGraph SDK Chat State",
        "url": "https://docs.example.local/langgraph-sdk-chat-state",
        "source_type": "reference",
        "text": (
            "LangGraph SDK clients stream graph updates and then read final thread state. UI code "
            "should use structured fields for durable values instead of parsing assistant text."
        ),
        "keywords": ["langgraph", "sdk", "stream", "updates", "state", "structured", "chat"],
    },
    {
        "id": "doc-stream",
        "title": "Streaming Evidence Panels",
        "url": "https://docs.example.local/streaming-evidence-panels",
        "source_type": "reference",
        "text": (
            "Streaming UIs can show updates and custom events while the graph is running. Raw stream "
            "events are useful for debugging citation payloads and renderer state."
        ),
        "keywords": ["stream", "updates", "custom", "events", "debug", "renderer"],
    },
    {
        "id": "doc-accessibility",
        "title": "Accessible Citation Controls",
        "url": "https://docs.example.local/accessible-citation-controls",
        "source_type": "checklist",
        "text": (
            "Citation chips should be keyboard reachable controls with predictable labels. Preview "
            "panels need source title, URL, and snippet so users can inspect evidence quickly."
        ),
        "keywords": ["accessible", "citation", "keyboard", "label", "preview", "url", "snippet"],
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


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, source_id: str = "", citation_id: str = "") -> CitationEvent:
    return {
        "type": "chat_citation_renderer",
        "schema_version": "v1",
        "phase": phase,
        "status": status,
        "detail": detail,
        "source_id": source_id,
        "citation_id": citation_id,
        "timestamp": _now(),
    }


def _emit(event: CitationEvent) -> CitationEvent:
    _writer()(event)
    return event


def _tokens(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9][a-z0-9-]*", value.lower())
        if len(token) > 1 and token not in STOPWORDS
    ]


def _score_doc(question_terms: set[str], doc: SourceDoc) -> tuple[float, list[str]]:
    body = f"{doc['title']} {doc['text']} {' '.join(doc['keywords'])}"
    doc_terms = set(_tokens(body))
    matched = sorted(question_terms.intersection(doc_terms))
    if not matched:
        return 0.0, []
    keyword_bonus = sum(0.04 for keyword in doc["keywords"] if keyword in question_terms)
    title_bonus = 0.08 if any(term in _tokens(doc["title"]) for term in question_terms) else 0.0
    coverage = len(matched) / max(len(question_terms), 1)
    return round(min(1.0, coverage + keyword_bonus + title_bonus), 3), matched


def _snippet(text: str, terms: list[str]) -> str:
    if not terms:
        return text[:220]
    lowered = text.lower()
    positions = [lowered.find(term) for term in terms if lowered.find(term) >= 0]
    start = max(min(positions) - 36, 0) if positions else 0
    end = min(start + 240, len(text))
    return text[start:end].strip()


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


def _sanitize_final_answer(answer: str) -> str:
    cleaned = re.sub(r"\banswer_segments\b", "answer sections", answer, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bcitation_events\b", "citation records", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\braw stream events\b", "diagnostic entries", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bupdates?\b", "state changes", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bcustom\b", "specialized", cleaned, flags=re.IGNORECASE)
    return cleaned


def retrieve_sources(state: ChatCitationState) -> dict:
    question = str(state.get("question") or DEFAULT_QUESTION).strip() or DEFAULT_QUESTION
    terms = set(_tokens(question))
    scored: list[tuple[float, list[str], SourceDoc]] = []
    for doc in DOCS:
        score, matched = _score_doc(terms, doc)
        if score > 0:
            scored.append((score, matched, doc))
    if not scored:
        scored = [(0.25, ["citation"], DOCS[0]), (0.2, ["structured"], DOCS[1])]
    ranked = sorted(scored, key=lambda item: (-item[0], item[2]["id"]))[:3]
    sources: list[RetrievedSource] = [
        {
            "id": doc["id"],
            "rank": index,
            "title": doc["title"],
            "url": doc["url"],
            "source_type": doc["source_type"],
            "score": score,
            "snippet": _snippet(doc["text"], matched),
            "text": doc["text"],
            "matched_terms": matched,
        }
        for index, (score, matched, doc) in enumerate(ranked, start=1)
    ]
    event = _emit(
        _event(
            "retrieve_sources",
            "completed",
            f"Retrieved {len(sources)} citation sources.",
            sources[0]["id"] if sources else "",
        )
    )
    return {
        "question": question,
        "sources": sources,
        "retrieved_docs": sources,
        "final_status": "running",
        "renderer_status": "running",
        "citation_events": [event],
    }


def build_citation_payload(state: ChatCitationState) -> dict:
    sources = state.get("sources", [])
    primary = sources[0]
    secondary = sources[1] if len(sources) > 1 else sources[0]
    tertiary = sources[2] if len(sources) > 2 else secondary
    answer_segments: list[AnswerSegment] = [
        {
            "id": "seg-1",
            "text": "Keep citation metadata in structured state so chips do not depend on brittle answer parsing.",
            "citation_ids": [f"cite-{primary['id']}-seg-1", f"cite-{secondary['id']}-seg-1"],
        },
        {
            "id": "seg-2",
            "text": "Render each citation chip as a button that opens a source preview and highlights the matching document card.",
            "citation_ids": [f"cite-{primary['id']}-seg-2", f"cite-{tertiary['id']}-seg-2"],
        },
    ]
    citations: list[Citation] = []
    by_id = {source["id"]: source for source in sources}
    for segment in answer_segments:
        for citation_id in segment["citation_ids"]:
            source_id = citation_id.removeprefix("cite-").removesuffix(f"-{segment['id']}")
            source = by_id.get(source_id)
            if not source:
                continue
            citations.append(
                {
                    "id": citation_id,
                    "label": f"[{source_id}]",
                    "source_id": source_id,
                    "segment_id": segment["id"],
                    "title": source["title"],
                    "url": source["url"],
                    "snippet": source["snippet"],
                    "rank": source["rank"],
                    "score": source["score"],
                }
            )
    events = [
        _emit(_event("build_citations", "completed", f"Linked {citation['id']}.", citation["source_id"], citation["id"]))
        for citation in citations[:4]
    ]
    return {
        "answer_segments": answer_segments,
        "citations": citations,
        "citation_ok": bool(citations),
        "citation_events": events,
    }


def generate_answer(state: ChatCitationState) -> dict:
    sources = state.get("sources", [])
    segments = state.get("answer_segments", [])
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You are a citation UI assistant. Explain the answer in two concise paragraphs. "
                    "Mention that source metadata is structured separately from answer text. Do not "
                    "invent source ids beyond the provided sources."
                )
            ),
            HumanMessage(
                content=(
                    f"QUESTION:\n{state.get('question', DEFAULT_QUESTION)}\n\n"
                    f"SOURCES:\n{sources}\n\n"
                    f"STRUCTURED ANSWER SEGMENTS:\n{segments}"
                )
            ),
        ]
    )
    answer = _sanitize_final_answer(_extract_text(response.content).strip())
    event = _emit(_event("generate_answer", "completed", "OpenAI generated the citation-aware final answer."))
    return {
        "answer": answer,
        "answer_text": answer,
        "final": answer,
        "citation_events": [event],
    }


def finalize(state: ChatCitationState) -> dict:
    event = _emit(_event("finalize", "completed", "Citation renderer final state is ready."))
    return {
        "final_status": "completed",
        "renderer_status": "completed",
        "citation_events": [event],
    }


def build_graph():
    builder = StateGraph(ChatCitationState)
    builder.add_node("retrieve_sources", retrieve_sources)
    builder.add_node("build_citation_payload", build_citation_payload)
    builder.add_node("generate_answer", generate_answer)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "retrieve_sources")
    builder.add_edge("retrieve_sources", "build_citation_payload")
    builder.add_edge("build_citation_payload", "generate_answer")
    builder.add_edge("generate_answer", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()
