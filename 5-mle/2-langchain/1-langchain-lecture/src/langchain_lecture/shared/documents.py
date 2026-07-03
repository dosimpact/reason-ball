"""문서 생성, 키워드 점수화, 검색 결과 포맷팅 공통 유틸입니다."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Iterable

from langchain_core.documents import Document


TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9가-힣]+")


@dataclass(frozen=True)
class RankedDocument:
    document: Document
    score: float
    rank: int


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_PATTERN.findall(text)]


def build_document(page_content: str, *, source: str, **metadata: object) -> Document:
    return Document(page_content=page_content, metadata={"source": source, **metadata})


def keyword_score(query: str, text: str) -> float:
    query_terms = tokenize(query)
    if not query_terms:
        return 0.0

    text_terms = tokenize(text)
    if not text_terms:
        return 0.0

    text_counts: dict[str, int] = {}
    for term in text_terms:
        text_counts[term] = text_counts.get(term, 0) + 1

    overlap = sum(text_counts.get(term, 0) for term in query_terms)
    coverage = len({term for term in query_terms if term in text_counts}) / len(set(query_terms))
    length_penalty = 1 / math.sqrt(max(len(text_terms), 1))
    return overlap + coverage + length_penalty


def rank_documents(
    query: str,
    documents: Iterable[Document],
    *,
    top_k: int = 4,
    min_score: float = 0,
) -> list[RankedDocument]:
    ranked = [
        RankedDocument(document=document, score=keyword_score(query, document.page_content), rank=0)
        for document in documents
    ]
    ranked = [item for item in ranked if item.score >= min_score]
    ranked.sort(key=lambda item: item.score, reverse=True)
    return [
        RankedDocument(document=item.document, score=item.score, rank=index + 1)
        for index, item in enumerate(ranked[:top_k])
    ]


def format_ranked_documents(results: Iterable[RankedDocument]) -> str:
    lines = []
    for result in results:
        source = result.document.metadata.get("source", "unknown")
        lines.append(f"{result.rank}. {source} score={result.score:.2f}: {result.document.page_content}")
    return "\n".join(lines)
