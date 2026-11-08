"""
임베딩 백엔드 - OpenAI (기본) 또는 sentence-transformers (옵션).

선택 방법: 환경변수 EMBEDDING_BACKEND=openai|sbert (기본 openai)

두 백엔드 모두 동일한 시그니처 `embed_text(str) -> list[float]` 를 노출합니다.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from langchain_openai import OpenAIEmbeddings

EMBEDDING_BACKEND = os.environ.get("EMBEDDING_BACKEND", "openai").lower()
OPENAI_EMBED_MODEL = os.environ.get("OPENAI_EMBED_MODEL", "text-embedding-3-small")
SBERT_MODEL = os.environ.get("SBERT_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def _openai_embedder() -> Any:
    return OpenAIEmbeddings(model=OPENAI_EMBED_MODEL)


def _embed_openai(text: str) -> list[float]:
    return list(_openai_embedder().embed_query(text))


@lru_cache(maxsize=1)
def _sbert_model() -> Any:
    from sentence_transformers import SentenceTransformer  # type: ignore

    return SentenceTransformer(SBERT_MODEL)


def _embed_sbert(text: str) -> list[float]:
    model = _sbert_model()
    return model.encode(text, normalize_embeddings=False).tolist()


def embed_text(text: str) -> list[float]:
    """주어진 텍스트의 임베딩 벡터(list[float]) 반환."""
    if EMBEDDING_BACKEND == "sbert":
        return _embed_sbert(text)
    return _embed_openai(text)


__all__ = ["embed_text", "EMBEDDING_BACKEND"]
