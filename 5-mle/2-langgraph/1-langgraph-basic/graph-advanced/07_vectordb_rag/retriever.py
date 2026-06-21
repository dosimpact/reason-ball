"""Hybrid retriever: Qdrant (dense) + BM25 (sparse) + RRF 결합.

`ingest.py` 가 이미 collection 을 채워뒀다고 가정.
BM25 인덱스는 collection 의 모든 페이로드를 메모리에 올려 빌드 (수천 문서 까지 충분).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm
from rank_bm25 import BM25Okapi

from embeddings import embed_query


def _tokenize(text: str) -> list[str]:
    return [t for t in text.lower().replace("\n", " ").split() if t]


class HybridRetriever:
    """Qdrant + BM25 하이브리드 검색기."""

    def __init__(self, qdrant_url: str, collection: str):
        self.client = QdrantClient(url=qdrant_url)
        self.collection = collection
        self._docs: list[dict] = []
        self._bm25: BM25Okapi | None = None
        self._load_for_bm25()

    def _load_for_bm25(self) -> None:
        """collection 전체 페이로드를 끌어와 BM25 인덱스 구성."""
        try:
            points, _ = self.client.scroll(
                collection_name=self.collection,
                limit=10_000,
                with_payload=True,
                with_vectors=False,
            )
        except Exception as e:
            print(f"[retriever] WARN: BM25 인덱스 로드 실패 ({e}). ingest.py 먼저 실행하세요.")
            return

        for p in points:
            payload = p.payload or {}
            self._docs.append(
                {
                    "id": payload.get("doc_id", str(p.id)),
                    "title": payload.get("title", ""),
                    "text": payload.get("text", ""),
                }
            )
        if self._docs:
            corpus = [_tokenize(f"{d['title']} {d['text']}") for d in self._docs]
            self._bm25 = BM25Okapi(corpus)

    def _dense_search(self, query: str, top_k: int) -> list[dict]:
        vec = embed_query(query)
        res = self.client.search(
            collection_name=self.collection,
            query_vector=vec,
            limit=top_k,
            with_payload=True,
        )
        return [
            {
                "id": (r.payload or {}).get("doc_id", str(r.id)),
                "title": (r.payload or {}).get("title", ""),
                "text": (r.payload or {}).get("text", ""),
                "score": r.score,
            }
            for r in res
        ]

    def _sparse_search(self, query: str, top_k: int) -> list[dict]:
        if not self._bm25 or not self._docs:
            return []
        scores = self._bm25.get_scores(_tokenize(query))
        idxs = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        return [
            {**self._docs[i], "score": float(scores[i])}
            for i in idxs
            if scores[i] > 0
        ]

    @staticmethod
    def _rrf(rankings: Iterable[list[dict]], k: int = 60) -> list[dict]:
        """Reciprocal Rank Fusion."""
        agg: dict[str, dict] = {}
        for ranked in rankings:
            for rank, doc in enumerate(ranked):
                key = doc["id"]
                slot = agg.setdefault(key, {"doc": doc, "score": 0.0})
                slot["score"] += 1.0 / (k + rank + 1)
        merged = sorted(agg.values(), key=lambda x: x["score"], reverse=True)
        return [{**m["doc"], "rrf_score": m["score"]} for m in merged]

    def hybrid_search(self, query: str, top_k: int = 8) -> list[dict]:
        dense = self._dense_search(query, top_k=top_k)
        sparse = self._sparse_search(query, top_k=top_k)
        fused = self._rrf([dense, sparse])
        return fused[:top_k]


__all__ = ["HybridRetriever"]
