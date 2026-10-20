# 문서 인덱스를 만드는 CLI입니다: PDF 확보 → 페이지별 텍스트 분할 → 임베딩 → SQLite 저장.
# 새 DB를 완성한 뒤 교체하므로 준비 과정이 실패해도 기존 검색 데이터를 유지합니다.
"""Prepare page-preserving PDF passages and atomically publish their embedding index."""

import argparse
import asyncio
import hashlib
import json
import os
import re
import sqlite3
import tempfile
from pathlib import Path

import httpx
from dotenv import load_dotenv
from pypdf import PdfReader

from agent.documents import MODEL, ROOT, data_directory, embed, pack, validate_vectors

SOURCES = [
    {
        "id": "nvidia",
        "name": "NVIDIA 10-K, fiscal 2026",
        "period": "Fiscal year ended January 25, 2026",
        "url": "https://investor.nvidia.com/files/doc_financials/2026/q4/10K-NVDA.pdf",
    },
    {
        "id": "amd",
        "name": "AMD 10-K, fiscal 2025",
        "period": "Fiscal year ended December 27, 2025",
        "url": "https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000018/0000002488-26-000018.pdf",
    },
    {
        "id": "intel",
        "name": "Intel 10-K, fiscal 2025",
        "period": "Fiscal year ended December 27, 2025",
        "url": "https://www.intc.com/filings-reports/all-sec-filings/content/0000050863-26-000011/0000050863-26-000011.pdf",
    },
]


# 페이지 경계를 넘지 않고 겹치는 구절을 만들어 문맥과 페이지 출처를 함께 보존합니다.
def passages(text, size=1200, overlap=200):
    if not 0 <= overlap < size:
        raise ValueError("Expected 0 <= overlap < size")
    clean = re.sub(r"\s+", " ", text).strip()
    result = []
    for start in range(0, len(clean), size - overlap):
        chunk = clean[start : start + size]
        if len(chunk) > 80:
            result.append(chunk)
        if start + size >= len(clean):
            break
    return result


# 다운로드된 파일의 PDF 헤더와 종료 표시를 확인해 잘린 파일을 걸러냅니다.
def validate_pdf(path):
    with path.open("rb") as file:
        header = file.read(5)
        file.seek(max(0, path.stat().st_size - 2048))
        tail = file.read()
    if header != b"%PDF-" or b"%%EOF" not in tail:
        raise ValueError(f"Invalid or incomplete PDF: {path.name}")


# 이미 받은 샘플은 재사용하고, 새 다운로드는 임시 파일 검증 후 캐시에 반영합니다.
async def download(source, directory):
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{source['id']}.pdf"
    if path.exists():
        validate_pdf(path)
        return path
    fd, temporary = tempfile.mkstemp(dir=directory, suffix=".part")
    os.close(fd)
    temporary = Path(temporary)
    try:
        async with (
            httpx.AsyncClient(follow_redirects=True, timeout=300) as client,
            client.stream("GET", source["url"]) as response,
        ):
            response.raise_for_status()
            with await asyncio.to_thread(temporary.open, "wb") as file:
                async for chunk in response.aiter_bytes():
                    await asyncio.to_thread(file.write, chunk)
        validate_pdf(temporary)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


# 모든 PDF 추출과 임베딩이 성공한 뒤 새 SQLite를 완성해 기존 DB와 교체합니다.
async def prepare(inputs, directory, *, embedder=None):
    if not inputs:
        raise ValueError("No PDFs found")
    if len({item["id"] for item in inputs}) != len(inputs):
        raise ValueError("Duplicate document ids")
    documents, chunks = [], []
    for item in inputs:
        path = Path(item["path"])
        validate_pdf(path)
        reader = PdfReader(path)
        count = 0
        for page, pdf_page in enumerate(reader.pages, 1):
            for text in passages(pdf_page.extract_text() or ""):
                chunks.append((item["id"], page, text))
                count += 1
        if not count:
            raise ValueError(f"No searchable text in {path.name}; OCR may be required")
        documents.append(
            (
                item["id"],
                item["name"],
                item.get("period"),
                len(reader.pages),
                item.get("url"),
            )
        )
    vectors = []
    for start in range(0, len(chunks), 100):
        batch = chunks[start : start + 100]
        result = await (embedder or embed)([c[2] for c in batch])
        validate_vectors(result, len(batch))
        vectors.extend(result)
    validate_vectors(vectors, len(chunks))
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=directory, suffix=".sqlite")
    os.close(fd)
    try:
        db = sqlite3.connect(temporary)
        try:
            db.executescript("""
                CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE documents (id TEXT PRIMARY KEY, name TEXT NOT NULL,
                    period TEXT, pages INTEGER NOT NULL, url TEXT);
                CREATE TABLE chunks (id INTEGER PRIMARY KEY, document_id TEXT NOT NULL
                    REFERENCES documents(id), page INTEGER NOT NULL,
                    text TEXT NOT NULL, embedding BLOB NOT NULL);
                CREATE INDEX chunks_document ON chunks(document_id);
            """)
            db.executemany(
                "INSERT INTO metadata VALUES (?, ?)",
                [("embedding_model", MODEL), ("dimensions", str(len(vectors[0])))],
            )
            db.executemany("INSERT INTO documents VALUES (?, ?, ?, ?, ?)", documents)
            db.executemany(
                "INSERT INTO chunks(document_id,page,text,embedding) VALUES (?,?,?,?)",
                [
                    (*chunk, pack(vector))
                    for chunk, vector in zip(chunks, vectors, strict=True)
                ],
            )
            db.commit()
        finally:
            db.close()
        Path(temporary).replace(directory / "documents.sqlite")
    finally:
        Path(temporary).unlink(missing_ok=True)
    return {
        "documents": len(documents),
        "passages": len(chunks),
        "database": str(directory / "documents.sqlite"),
    }


# 샘플 보고서와 사용자 PDF를 수집합니다. 로컬 파일 ID는 이름 해시를 포함해 충돌 가능성을 줄입니다.
async def run(args):
    inputs = []
    if not args.no_samples:
        for source in SOURCES:
            inputs.append(
                {**source, "path": await download(source, args.data_dir / "pdfs")}
            )
    for path in sorted(args.documents_dir.glob("*")):
        if path.is_file() and path.suffix.lower() == ".pdf":
            slug = (
                re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-") or "document"
            )
            digest = hashlib.sha256(path.name.encode()).hexdigest()[:10]
            inputs.append(
                {"id": f"local-{slug}-{digest}", "name": path.stem, "path": path}
            )
    return await prepare(inputs, args.data_dir)


# 백엔드 환경 파일과 CLI 옵션을 읽어 준비 작업을 시작합니다. 실제 OpenAI 임베딩 비용이 발생합니다.
def main():
    load_dotenv(ROOT / ".env", override=False)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-samples", action="store_true", help="Import only local PDFs"
    )
    parser.add_argument("--documents-dir", type=Path, default=ROOT / "documents")
    parser.add_argument("--data-dir", type=Path, default=data_directory())
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args)), ensure_ascii=False))


if __name__ == "__main__":
    main()
