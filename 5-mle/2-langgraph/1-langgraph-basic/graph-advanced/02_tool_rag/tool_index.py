"""
Tool description 임베딩 인덱스 (in-memory, numpy).

CATALOG (name + description + examples) 를 임베딩해 저장하고,
사용자 질문 임베딩과 코사인 유사도가 높은 top-k tool 만 반환합니다.

첫 호출 시 lazy 하게 인덱스를 구축합니다.
"""
from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from langchain_core.tools import BaseTool

from embedder import embed_text
from tool_catalog import CATALOG, TOOLS_BY_NAME


def _meta_to_text(meta: dict[str, str]) -> str:
    return f"{meta['name']}\n{meta['description']}\nExamples: {meta['examples']}"


@lru_cache(maxsize=1)
def _build_index() -> tuple[np.ndarray, list[str]]:
    """전체 카탈로그를 임베딩해 (행렬, 이름목록) 반환."""
    names = [m["name"] for m in CATALOG]
    vectors: list[np.ndarray] = []
    for meta in CATALOG:
        v = np.asarray(embed_text(_meta_to_text(meta)), dtype=np.float32)
        n = np.linalg.norm(v)
        if n > 0:
            v = v / n
        vectors.append(v)
    matrix = np.stack(vectors)
    return matrix, names


def select_tools(query: str, k: int = 5) -> list[BaseTool]:
    """질문에 가장 관련 있는 top-k tool 반환."""
    matrix, names = _build_index()
    q = np.asarray(embed_text(query), dtype=np.float32)
    qn = np.linalg.norm(q)
    if qn > 0:
        q = q / qn
    sims = matrix @ q
    top_idx = np.argsort(-sims)[:k]
    return [TOOLS_BY_NAME[names[i]] for i in top_idx]


__all__ = ["select_tools"]
