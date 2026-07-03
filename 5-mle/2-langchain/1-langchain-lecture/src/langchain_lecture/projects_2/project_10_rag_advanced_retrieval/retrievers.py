"""청킹, 검색기 조합, 평가를 포함한 고급 RAG 검색 예제입니다. 키워드 검색과 재정렬 같은 검색 전략을 제공합니다."""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Literal

from langchain_core.documents import Document

from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.ingest import load_corpus
from langchain_lecture.shared.documents import RankedDocument, build_document, tokenize


RetrievalStrategy = Literal[
    "baseline",
    "rewrite",
    "multi_query",
    "hybrid",
    "compression",
    "rerank",
]

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "for",
    "how",
    "in",
    "is",
    "of",
    "or",
    "the",
    "to",
    "what",
    "when",
    "where",
    "with",
    "어디를",
    "어떻게",
    "무엇",
    "무엇을",
    "무슨",
    "왜",
    "할",
    "해야",
    "하나요",
}

SYNONYMS: dict[str, tuple[str, ...]] = {
    "느려": ("latency", "p95", "timeout", "slow"),
    "느린": ("latency", "p95", "timeout", "slow"),
    "속도": ("latency", "p95", "throughput"),
    "비용": ("cost", "token", "cache", "budget"),
    "싸게": ("cost", "cache", "token"),
    "문서": ("document", "chunk", "source"),
    "쪼개": ("chunk", "split", "overlap"),
    "나누": ("chunk", "split", "overlap"),
    "정확": ("precision", "rerank", "validation"),
    "못찾": ("recall", "multi-query", "rewrite"),
    "여러": ("multi-query", "coverage", "recall"),
    "근거": ("evidence", "source", "validation"),
    "검색": ("retrieval", "source", "evidence"),
    "결과": ("result", "candidate", "evidence"),
    "부족": ("insufficient", "weak", "validation", "evidence"),
    "답": ("answer", "generation", "grounded"),
    "환각": ("hallucination", "validation", "evidence"),
    "평가": ("evaluation", "hit rate", "expected source"),
    "보안": ("pii", "secret", "safety"),
    "개인정보": ("pii", "masking", "safety"),
    "재작성": ("rewrite", "canonical query"),
    "압축": ("compression", "sentence", "context"),
    "rerank": ("reranking", "precision", "order"),
    "slow": ("latency", "p95", "timeout"),
    "cheap": ("cost", "token", "cache"),
    "split": ("chunk", "overlap", "boundary"),
}


@dataclass(frozen=True)
class RetrievalConfig:
    top_k: int = 4
    candidate_k: int = 8
    min_score: float = 0.05


@dataclass(frozen=True)
class RetrievalValidation:
    valid: bool
    confidence: float
    reason: str
    matched_terms: list[str]
    missing_terms: list[str]


def meaningful_terms(text: str) -> list[str]:
    return [term for term in tokenize(text) if len(term) > 1 and term not in STOPWORDS]


def rewrite_query(query: str) -> str:
    """Expand lecture-friendly synonyms into retrieval terms."""
    terms = meaningful_terms(query)
    expanded: list[str] = []
    for term in terms:
        expanded.append(term)
        for key, values in SYNONYMS.items():
            if key in term or term in key:
                expanded.extend(values)
    return " ".join(dict.fromkeys(expanded))


def generate_query_variants(query: str) -> list[str]:
    rewritten = rewrite_query(query)
    variants = [
        query,
        rewritten,
        f"{rewritten} evidence source validation",
    ]

    lower = query.lower()
    if "비교" in query or "tradeoff" in lower or "장단점" in query:
        variants.append(f"{rewritten} precision recall latency cost tradeoff")
    if "여러" in query or "종합" in query or "broad" in lower:
        variants.append(f"{rewritten} multi-query chunk evaluation reranking")
    if "느려" in query or "slow" in lower:
        variants.append(f"{rewritten} p95 latency timeout runbook")
    return list(dict.fromkeys(variant.strip() for variant in variants if variant.strip()))


def lexical_score(query: str, text: str) -> float:
    query_terms = meaningful_terms(query)
    if not query_terms:
        return 0.0
    text_terms = meaningful_terms(text)
    if not text_terms:
        return 0.0

    counts = Counter(text_terms)
    unique_query_terms = set(query_terms)
    overlap = sum(counts.get(term, 0) for term in query_terms)
    coverage = len(unique_query_terms.intersection(counts)) / len(unique_query_terms)
    phrase_boost = 1.0 if query.lower() in text.lower() else 0.0
    return overlap + (2.5 * coverage) + phrase_boost


def cosine_score(query: str, text: str) -> float:
    query_counts = Counter(meaningful_terms(query))
    text_counts = Counter(meaningful_terms(text))
    if not query_counts or not text_counts:
        return 0.0

    dot = sum(weight * text_counts.get(term, 0) for term, weight in query_counts.items())
    query_norm = math.sqrt(sum(weight * weight for weight in query_counts.values()))
    text_norm = math.sqrt(sum(weight * weight for weight in text_counts.values()))
    if not query_norm or not text_norm:
        return 0.0
    return dot / (query_norm * text_norm)


def hybrid_score(query: str, document: Document) -> float:
    expanded = rewrite_query(query)
    text = f"{document.metadata.get('title', '')} {document.page_content}"
    return lexical_score(expanded, text) + (4.0 * cosine_score(expanded, text))


def _rank(scored: Iterable[tuple[Document, float]], top_k: int, min_score: float) -> list[RankedDocument]:
    filtered = [(document, score) for document, score in scored if score >= min_score]
    filtered.sort(
        key=lambda item: (
            item[1],
            str(item[0].metadata.get("source", "")),
            -int(item[0].metadata.get("chunk_index", 0) or 0),
        ),
        reverse=True,
    )
    return [
        RankedDocument(document=document, score=score, rank=index + 1)
        for index, (document, score) in enumerate(filtered[:top_k])
    ]


def _merge_rankings(rankings: Iterable[list[RankedDocument]], top_k: int) -> list[RankedDocument]:
    by_chunk: dict[str, tuple[Document, float]] = {}
    for ranking in rankings:
        for item in ranking:
            chunk_id = str(item.document.metadata.get("chunk_id", id(item.document)))
            previous = by_chunk.get(chunk_id)
            score = item.score + (1 / item.rank)
            if previous is None or score > previous[1]:
                by_chunk[chunk_id] = (item.document, score)
    return _rank(by_chunk.values(), top_k=top_k, min_score=0.0)


SENTENCE_PATTERN = re.compile(r"(?<=[.!?])\s+|(?<=다\.)\s+")


def compress_document(query: str, ranked: RankedDocument, max_sentences: int = 2) -> RankedDocument:
    expanded = rewrite_query(query)
    query_terms = set(meaningful_terms(expanded))
    sentences = [sentence.strip() for sentence in SENTENCE_PATTERN.split(ranked.document.page_content) if sentence.strip()]
    selected = [
        sentence
        for sentence in sentences
        if query_terms.intersection(meaningful_terms(sentence))
    ][:max_sentences]
    if not selected and sentences:
        selected = sentences[:1]
    compressed = build_document(
        " ".join(selected),
        source=str(ranked.document.metadata.get("source", "unknown")),
        title=str(ranked.document.metadata.get("title", "")),
        chunk_id=str(ranked.document.metadata.get("chunk_id", "")),
        chunk_index=ranked.document.metadata.get("chunk_index", 0),
        compressed=True,
    )
    return RankedDocument(document=compressed, score=ranked.score, rank=ranked.rank)


class AdvancedRetriever:
    """Deterministic retriever used for lecture experiments without API keys."""

    def __init__(self, documents: Iterable[Document] | None = None, config: RetrievalConfig | None = None) -> None:
        self.documents = list(documents) if documents is not None else load_corpus()
        self.config = config or RetrievalConfig()

    def retrieve(
        self,
        query: str,
        *,
        strategy: RetrievalStrategy = "baseline",
        top_k: int | None = None,
    ) -> list[RankedDocument]:
        top_k = top_k or self.config.top_k
        if strategy == "baseline":
            return self._baseline(query, top_k)
        if strategy == "rewrite":
            return self._rewritten(query, top_k)
        if strategy == "multi_query":
            return self._multi_query(query, top_k)
        if strategy == "hybrid":
            return self._hybrid(query, top_k)
        if strategy == "compression":
            return self._compressed(query, top_k)
        if strategy == "rerank":
            return self._reranked(query, top_k)
        raise ValueError(f"Unknown retrieval strategy: {strategy}")

    def _baseline(self, query: str, top_k: int) -> list[RankedDocument]:
        return _rank(
            ((document, lexical_score(query, document.page_content)) for document in self.documents),
            top_k=top_k,
            min_score=self.config.min_score,
        )

    def _rewritten(self, query: str, top_k: int) -> list[RankedDocument]:
        rewritten = rewrite_query(query)
        return _rank(
            ((document, lexical_score(rewritten, f"{document.metadata.get('title', '')} {document.page_content}")) for document in self.documents),
            top_k=top_k,
            min_score=self.config.min_score,
        )

    def _hybrid(self, query: str, top_k: int) -> list[RankedDocument]:
        return _rank(
            ((document, hybrid_score(query, document)) for document in self.documents),
            top_k=top_k,
            min_score=self.config.min_score,
        )

    def _multi_query(self, query: str, top_k: int) -> list[RankedDocument]:
        rankings = [
            _rank(
                ((document, hybrid_score(variant, document)) for document in self.documents),
                top_k=self.config.candidate_k,
                min_score=self.config.min_score,
            )
            for variant in generate_query_variants(query)
        ]
        return _merge_rankings(rankings, top_k)

    def _compressed(self, query: str, top_k: int) -> list[RankedDocument]:
        candidates = self._multi_query(query, self.config.candidate_k)
        compressed = [compress_document(query, item) for item in candidates]
        reranked = self._rerank_candidates(query, compressed)
        return reranked[:top_k]

    def _reranked(self, query: str, top_k: int) -> list[RankedDocument]:
        candidates = self._multi_query(query, self.config.candidate_k)
        return self._rerank_candidates(query, candidates)[:top_k]

    def _rerank_candidates(self, query: str, candidates: list[RankedDocument]) -> list[RankedDocument]:
        expanded = rewrite_query(query)
        scored: list[tuple[Document, float]] = []
        for item in candidates:
            source = str(item.document.metadata.get("source", ""))
            title = str(item.document.metadata.get("title", ""))
            evidence_text = f"{source} {title} {item.document.page_content}"
            coverage = lexical_score(expanded, evidence_text)
            compact_bonus = 0.25 if item.document.metadata.get("compressed") else 0.0
            scored.append((item.document, item.score + coverage + compact_bonus))
        return _rank(scored, top_k=len(scored), min_score=0.0)


def validate_retrieval(query: str, results: list[RankedDocument], *, min_score: float = 1.0) -> RetrievalValidation:
    if not results:
        return RetrievalValidation(False, 0.0, "No candidate documents were retrieved.", [], meaningful_terms(query))

    expanded_terms = set(meaningful_terms(rewrite_query(query)))
    evidence_text = " ".join(item.document.page_content for item in results[:3])
    evidence_terms = set(meaningful_terms(evidence_text))
    matched = sorted(expanded_terms.intersection(evidence_terms))
    missing = sorted(expanded_terms.difference(evidence_terms))
    best_score = results[0].score
    confidence = min(1.0, (len(matched) / max(len(expanded_terms), 1)) + min(best_score / 10, 0.35))
    valid = best_score >= min_score and bool(matched)
    reason = "Sufficient evidence found." if valid else "Retrieved context is too weak for a grounded answer."
    return RetrievalValidation(valid, confidence, reason, matched, missing)
