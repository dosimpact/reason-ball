"""OpenAI embeddings wrapper."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from langchain_openai import OpenAIEmbeddings

EMBED_MODEL_ID = os.environ.get("OPENAI_EMBED_MODEL", "text-embedding-3-small")
EMBED_DIM = int(os.environ.get("OPENAI_EMBED_DIM", "1536"))


@lru_cache(maxsize=1)
def _embedder() -> Any:
    return OpenAIEmbeddings(model=EMBED_MODEL_ID)


def embed_query(text: str) -> list[float]:
    return list(_embedder().embed_query(text))


def embed_documents(texts: list[str]) -> list[list[float]]:
    return [list(v) for v in _embedder().embed_documents(texts)]


__all__ = ["embed_query", "embed_documents", "EMBED_DIM"]
