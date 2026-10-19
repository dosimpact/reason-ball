# 문서 검색의 실행 계층입니다. 준비된 SQLite에서 구절을 읽고 질문 임베딩과 비교합니다.
# 모델에 전달할 검색 도구와 Documents 화면용 목록을 제공하며 데이터는 이 백엔드가 소유합니다.
"""Backend-owned document storage, embeddings and semantic search."""

import asyncio
import json
import math
import os
import sqlite3
import struct
from pathlib import Path

from langchain_core.tools import tool
from openai import APIError, AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(__file__).resolve().parents[1]
MODEL = "text-embedding-3-small"


# 준비 CLI와 검색 서버가 공유할 백엔드 데이터 경로를 결정합니다.
def data_directory():
    return Path(os.environ.get("DOCUMENT_DATA_DIR", str(ROOT / "data"))).resolve()


# 질문과 문서 구절에 같은 임베딩 모델을 사용하고, 응답 순서·개수·차원을 검증합니다.
async def embed(texts):
    async with AsyncOpenAI() as client:
        response = await client.embeddings.create(model=MODEL, input=texts)
    vectors = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
    validate_vectors(vectors, len(texts))
    return vectors


def validate_vectors(vectors, count):
    if len(vectors) != count or not vectors:
        raise ValueError("Embedding count does not match passages")
    dimension = len(vectors[0])
    if not dimension or any(
        len(v) != dimension or not all(math.isfinite(x) for x in v) for v in vectors
    ):
        raise ValueError("Invalid embedding dimensions or values")


def pack(vector):
    return struct.pack(f"<{len(vector)}f", *vector)


def unpack(blob):
    return struct.unpack(f"<{len(blob) // 4}f", blob)


# 준비된 DB만 읽기 전용으로 엽니다. 데이터가 없으면 빈 DB를 만들지 않고 준비 명령을 안내합니다.
def open_database(path=None):
    path = Path(path) if path else data_directory() / "documents.sqlite"
    if not path.is_file():
        raise FileNotFoundError("Documents not prepared. Run uv run prepare-documents")
    db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return db


# LLM이 만든 검색 인자도 신뢰하지 않고 길이·개수·자료형을 검증합니다.
class SearchArguments(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)
    query: str = Field(
        min_length=3,
        max_length=300,
        description="Describe the exact information, e.g. total net revenue for the latest fiscal year and percentage growth compared to prior year; avoid bare topic keywords.",
    )
    document_ids: list[str] = Field(max_length=10)
    passages_per_document: int = Field(ge=1, le=4)


# 한 번의 검색에 필요한 DB 내용을 동기적으로 읽습니다. 호출자는 이를 이벤트 루프 밖에서 실행합니다.
def search_snapshot(args, db_path):
    db = open_database(db_path)
    try:
        metadata = dict(db.execute("SELECT key, value FROM metadata"))
        if metadata.get("embedding_model") != MODEL:
            raise ValueError("Embedding model mismatch; prepare documents again")
        documents = db.execute("SELECT * FROM documents ORDER BY rowid").fetchall()
        unknown = set(args.document_ids) - {d["id"] for d in documents}
        if unknown:
            raise ValueError(f"Unknown documents: {', '.join(sorted(unknown))}")
        rows = db.execute(
            "SELECT document_id, page, text, embedding FROM chunks"
        ).fetchall()
    finally:
        db.close()
    return metadata, documents, rows


# 문서마다 유사도 상위 구절을 골라 페이지와 출처를 돌려줍니다. found는 점수 기준이며 사실 부재의 확정이 아닙니다.
async def execute_search(args, *, db_path=None, embedder=None):
    args = SearchArguments.model_validate(args)
    metadata, documents, rows = await asyncio.to_thread(search_snapshot, args, db_path)
    vectors = await (embedder or embed)([args.query])
    validate_vectors(vectors, 1)
    query = vectors[0]
    if len(query) != int(metadata["dimensions"]):
        raise ValueError("Query embedding dimension mismatch")
    results = []
    for document in documents:
        if args.document_ids and document["id"] not in args.document_ids:
            continue
        matches = []
        for row in rows:
            if row["document_id"] != document["id"]:
                continue
            vector = unpack(row["embedding"])
            if len(vector) != len(query):
                raise ValueError("Stored embedding dimension mismatch")
            score = sum(a * b for a, b in zip(query, vector, strict=True))
            matches.append((score, row))
        matches.sort(key=lambda item: item[0], reverse=True)
        matches = matches[: args.passages_per_document]
        passages = []
        for score, row in matches:
            passage = {
                "page": row["page"],
                "text": row["text"],
                "score": round(score, 3),
            }
            if document["url"]:
                passage["url"] = f"{document['url']}#page={row['page']}"
            passages.append(passage)
        results.append(
            {
                "document_id": document["id"],
                "document": document["name"],
                "period": document["period"],
                "found": bool(matches and matches[0][0] >= 0.3),
                "passages": passages,
            }
        )
    return json.dumps({"query": args.query, "results": results}, ensure_ascii=False)


# LangGraph에 등록하는 도구 경계입니다. 검색 실패는 근거 없음과 구분되는 오류 결과로 반환합니다.
@tool(args_schema=SearchArguments)
async def search_documents(
    query: str, document_ids: list[str], passages_per_document: int
) -> str:
    """Find cited passages for one comparison criterion. Empty document_ids searches all.

    Use 2 passages per document normally. Use 4 and rephrase if the actual figure is absent,
    even when found is true. Search all documents together for each criterion.
    """
    try:
        return await execute_search(
            {
                "query": query,
                "document_ids": document_ids,
                "passages_per_document": passages_per_document,
            }
        )
    except APIError:
        return json.dumps(
            {"error": "Embedding provider request failed; retry the search."}
        )
    except (FileNotFoundError, ValueError, sqlite3.Error) as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


# 문서 정보와 구절 수를 묶어 Documents 화면에 필요한 목록을 만듭니다.
def list_documents():
    db = open_database()
    try:
        return [
            dict(row)
            for row in db.execute("""
            SELECT d.*, COUNT(c.id) AS passages FROM documents d
            LEFT JOIN chunks c ON d.id=c.document_id GROUP BY d.id ORDER BY d.rowid
        """)
        ]
    finally:
        db.close()
