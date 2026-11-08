"""
OpenAI embeddings backend (in-memory).
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from langchain_openai import OpenAIEmbeddings

OPENAI_EMBED_MODEL = os.environ.get("OPENAI_EMBED_MODEL", "text-embedding-3-small")


@lru_cache(maxsize=1)
def _embedder() -> Any:
    return OpenAIEmbeddings(model=OPENAI_EMBED_MODEL)


def embed_text(text: str) -> list[float]:
    return list(_embedder().embed_query(text))


__all__ = ["embed_text"]
