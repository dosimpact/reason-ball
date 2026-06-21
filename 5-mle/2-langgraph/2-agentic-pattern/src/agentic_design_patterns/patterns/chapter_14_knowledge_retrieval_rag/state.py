from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal, TypedDict


ContextQuality = Literal["sufficient", "weak", "missing", "contradictory", "fragmented"]
FinalStatus = Literal["answered", "insufficient_context", "failed"]
GroundingStatus = Literal[
    "grounded",
    "unsupported",
    "partially_supported",
    "not_checked",
    "failed",
]
RetrievalStrategy = Literal["semantic", "keyword", "hybrid"]


class Document(TypedDict, total=False):
    source_id: str
    title: str
    body: str
    sections: list[dict[str, Any]]
    metadata: dict[str, Any]
    relationships: list[str]


class Chunk(TypedDict, total=False):
    chunk_id: str
    source_id: str
    title: str
    section: str
    text: str
    metadata: dict[str, Any]
    relationships: list[str]
    score: float
    keyword_score: float
    semantic_score: float


class Citation(TypedDict, total=False):
    source_id: str
    title: str
    section: str
    chunk_id: str
    score: float
    missing: bool


class KnowledgeRetrievalRAGState(TypedDict, total=False):
    input: str
    normalized_query: str
    retrieval_query: str
    query_rewrites: list[str]
    corpus_name: str
    documents: list[Document]
    chunks: list[Chunk]
    index_metadata: dict[str, Any]
    retrieval_strategy: RetrievalStrategy
    retrieval_config: dict[str, Any]
    retrieval_attempts: int
    retrieved_chunks: list[Chunk]
    ranked_chunks: list[Chunk]
    related_chunks: list[Chunk]
    context: str
    source_metadata: list[Citation]
    context_quality: ContextQuality
    contradictions: list[dict[str, Any]]
    knowledge_gap: str | None
    augmented_prompt: str
    draft_answer: str
    raw_model_output: str
    citations: list[Citation]
    grounding_status: GroundingStatus
    confidence: float
    errors: list[str]
    final_output: dict[str, Any] | None
    status: FinalStatus | None
    retriever: Callable[..., list[dict[str, Any]]]
