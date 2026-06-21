"""문서 인덱싱 스크립트.

data/*.md 를 읽어 청킹 → Bedrock Titan embedding → Qdrant 저장.

실행:
    python ingest.py [--reset]
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from embeddings import embed_documents, EMBED_DIM


DATA_DIR = Path(__file__).parent / "data"


def chunk_markdown(text: str, max_chars: int = 800, overlap: int = 100) -> list[str]:
    """마크다운 헤더 우선 분할 → 길면 고정 크기로 추가 분할."""
    sections = re.split(r"(?m)^#{1,6}\s+.*$", text)
    headers = re.findall(r"(?m)^#{1,6}\s+.*$", text)
    blocks: list[str] = []
    if headers:
        cursor_text = sections[0].strip()
        if cursor_text:
            blocks.append(cursor_text)
        for h, body in zip(headers, sections[1:]):
            blocks.append((h + "\n" + body).strip())
    else:
        blocks = [text.strip()]

    chunks: list[str] = []
    for blk in blocks:
        if len(blk) <= max_chars:
            chunks.append(blk)
            continue
        i = 0
        while i < len(blk):
            chunks.append(blk[i : i + max_chars])
            i += max_chars - overlap
    return [c for c in chunks if c.strip()]


def main(reset: bool) -> None:
    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    collection = os.environ.get("QDRANT_COLLECTION", "langgraph_advanced")
    client = QdrantClient(url=qdrant_url)

    if reset and client.collection_exists(collection):
        client.delete_collection(collection)

    if not client.collection_exists(collection):
        client.create_collection(
            collection_name=collection,
            vectors_config=qm.VectorParams(size=EMBED_DIM, distance=qm.Distance.COSINE),
        )

    files = sorted(DATA_DIR.glob("*.md"))
    if not files:
        print(f"[ingest] {DATA_DIR} 안에 .md 파일이 없습니다.", file=sys.stderr)
        sys.exit(1)

    points: list[qm.PointStruct] = []
    chunk_specs: list[tuple[str, str, str]] = []  # (doc_id, title, text)
    for f in files:
        raw = f.read_text(encoding="utf-8")
        title = f.stem
        for idx, ch in enumerate(chunk_markdown(raw)):
            doc_id = f"{f.stem}#chunk-{idx}"
            chunk_specs.append((doc_id, title, ch))

    print(f"[ingest] embedding {len(chunk_specs)} chunks ...")
    vectors = embed_documents([t for _, _, t in chunk_specs])

    for (doc_id, title, text), vec in zip(chunk_specs, vectors):
        points.append(
            qm.PointStruct(
                id=str(uuid.uuid4()),
                vector=vec,
                payload={"doc_id": doc_id, "title": title, "text": text},
            )
        )

    client.upsert(collection_name=collection, points=points)
    print(f"[ingest] upserted {len(points)} points into '{collection}'.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--reset", action="store_true", help="기존 collection 삭제 후 재생성")
    args = p.parse_args()
    main(reset=args.reset)
