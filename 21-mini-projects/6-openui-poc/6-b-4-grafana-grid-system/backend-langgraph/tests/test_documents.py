# 실제 PDF 추출과 SQLite를 사용해 문서 준비·검색을 검증합니다.
# 외부 임베딩 호출은 가짜 함수 또는 임시 로컬 HTTP 서버로 대체해 키 없이 재현합니다.
"""Exercise real PDF extraction and SQLite; replace only the external embedding API."""

import asyncio
import json
from pathlib import Path

import pytest
from pydantic import ValidationError
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from agent.documents import SearchArguments, execute_search, search_documents
from agent.prepare_documents import passages, prepare, validate_pdf


def pdf(path, texts):
    writer = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    ref = writer._add_object(font)
    for text in texts:
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): ref})}
        )
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 20 700 Td ({text}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
    return path


async def vectors(texts):
    return [[1.0, 0.0] if "revenue" in text.lower() else [0.0, 1.0] for text in texts]


def inputs(tmp_path):
    return [
        {
            "id": "a",
            "name": "Company A",
            "url": "https://example.com/a.pdf",
            "path": pdf(
                tmp_path / "a.pdf",
                ["Revenue was 10 million. " * 8, "Operating costs were stable. " * 8],
            ),
        },
        {
            "id": "b",
            "name": "Company B",
            "path": pdf(tmp_path / "b.pdf", ["Employee training increased. " * 8]),
        },
    ]


def test_prepare_and_search_real_pdf_sqlite(tmp_path):
    result = asyncio.run(prepare(inputs(tmp_path), tmp_path, embedder=vectors))
    assert result["documents"] == 2
    assert result["passages"] == 3
    response = json.loads(
        asyncio.run(
            execute_search(
                {"query": "revenue", "document_ids": [], "passages_per_document": 2},
                db_path=result["database"],
                embedder=vectors,
            )
        )
    )
    a, b = response["results"]
    assert a["found"] is True
    assert a["passages"][0]["page"] == 1
    assert a["passages"][0]["url"].endswith("#page=1")
    assert "10 million" in a["passages"][0]["text"]
    assert a["passages"][1]["page"] == 2
    assert b["found"] is False
    assert "url" not in b["passages"][0]
    selected = json.loads(
        asyncio.run(
            execute_search(
                {"query": "revenue", "document_ids": ["b"], "passages_per_document": 1},
                db_path=result["database"],
                embedder=vectors,
            )
        )
    )
    assert [x["document_id"] for x in selected["results"]] == ["b"]


def test_unknown_id_rejected_before_provider(tmp_path):
    asyncio.run(prepare(inputs(tmp_path), tmp_path, embedder=vectors))
    with pytest.raises(ValueError, match="Unknown documents"):
        asyncio.run(
            execute_search(
                {
                    "query": "revenue",
                    "document_ids": ["missing"],
                    "passages_per_document": 2,
                },
                db_path=tmp_path / "documents.sqlite",
                embedder=None,
            )
        )


def test_failed_embedding_preserves_previous_database(tmp_path):
    docs = inputs(tmp_path)
    asyncio.run(prepare(docs, tmp_path, embedder=vectors))
    before = (tmp_path / "documents.sqlite").read_bytes()

    async def broken(texts):
        raise RuntimeError("provider unavailable")

    with pytest.raises(RuntimeError):
        asyncio.run(prepare(docs, tmp_path, embedder=broken))
    assert (tmp_path / "documents.sqlite").read_bytes() == before
    assert len(list(tmp_path.glob("*.sqlite"))) == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"query": " "},
        {"query": "x" * 301},
        {"passages_per_document": 0},
        {"passages_per_document": 5},
        {"passages_per_document": True},
        {"document_ids": ["a"] * 11},
        {"extra": True},
    ],
)
def test_argument_validation(changes):
    with pytest.raises(ValidationError):
        SearchArguments.model_validate(
            {
                "query": "revenue",
                "document_ids": [],
                "passages_per_document": 2,
                **changes,
            }
        )


def test_missing_db_tool_returns_actionable_error(tmp_path, monkeypatch):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    response = json.loads(
        asyncio.run(
            search_documents.ainvoke(
                {"query": "revenue", "document_ids": [], "passages_per_document": 2}
            )
        )
    )
    assert "prepare-documents" in response["error"]
    assert not (tmp_path / "documents.sqlite").exists()


def test_invalid_pdf_and_empty_text(tmp_path):
    invalid = tmp_path / "bad.pdf"
    invalid.write_bytes(b"%PDF- truncated")
    with pytest.raises(ValueError, match="incomplete"):
        validate_pdf(invalid)
    blank = pdf(tmp_path / "blank.pdf", [""])
    with pytest.raises(ValueError, match="OCR"):
        asyncio.run(
            prepare(
                [{"id": "blank", "name": "blank", "path": blank}],
                tmp_path,
                embedder=vectors,
            )
        )


def test_chunk_overlap_and_boundary():
    text = "a" * 1300
    chunks = passages(text)
    assert list(map(len, chunks)) == [1200, 300]
    assert chunks[0][-200:] == chunks[1][:200]
    assert passages("a" * 80) == []
    assert len(passages("a" * 1200)) == 1


def test_dimension_and_count_validation(tmp_path):
    async def wrong_count(texts):
        return [[1.0]]

    with pytest.raises(ValueError, match="count"):
        asyncio.run(prepare(inputs(tmp_path), tmp_path, embedder=wrong_count))
    asyncio.run(prepare(inputs(tmp_path), tmp_path, embedder=vectors))
    with pytest.raises(ValueError, match="dimension"):
        asyncio.run(
            execute_search(
                {"query": "revenue", "document_ids": [], "passages_per_document": 2},
                db_path=tmp_path / "documents.sqlite",
                embedder=wrong_count,
            )
        )


def test_installed_cli_and_tool_through_embedding_http(tmp_path, monkeypatch):
    """Run the real CLI and OpenAI client against a task-owned local API fixture."""
    import os
    import subprocess
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    calls = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            calls.append(body)
            values = asyncio.run(vectors(body["input"]))
            response = json.dumps(
                {
                    "object": "list",
                    "model": "text-embedding-3-small",
                    "data": [
                        {"object": "embedding", "index": i, "embedding": v}
                        for i, v in enumerate(values)
                    ],
                    "usage": {"prompt_tokens": 1, "total_tokens": 1},
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    local = tmp_path / "documents"
    local.mkdir()
    pdf(local / "report.pdf", ["Revenue was 10 million dollars. " * 8])
    target = tmp_path / "data"
    monkeypatch.setenv("OPENAI_API_KEY", "local-test-only")
    monkeypatch.setenv("OPENAI_BASE_URL", f"http://127.0.0.1:{server.server_port}/v1")
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(target))
    try:
        import sys

        cli = str(Path(sys.executable).parent / "prepare-documents")
        result = subprocess.run(
            [
                cli,
                "--no-samples",
                "--documents-dir",
                str(local),
                "--data-dir",
                str(target),
            ],
            cwd=tmp_path,
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
        assert json.loads(result.stdout)["documents"] == 1
        answer = json.loads(
            asyncio.run(
                search_documents.ainvoke(
                    {"query": "revenue", "document_ids": [], "passages_per_document": 2}
                )
            )
        )
        assert answer["results"][0]["found"] is True
        assert answer["results"][0]["passages"][0]["page"] == 1
        assert len(calls) == 2
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_graph_registers_document_search(monkeypatch):
    import importlib

    monkeypatch.setenv("OPENAI_API_KEY", "local-test-only")
    module = importlib.import_module("agent.graph")
    tools = module.graph.nodes["tools"].bound.tools_by_name
    assert "search_documents" in tools


def test_original_page_reading_is_complete_paginated_and_offline(tmp_path):
    from agent.document_pages import read_page

    result = asyncio.run(prepare(inputs(tmp_path), tmp_path, embedder=vectors))
    first = read_page("a", 1, limit=30, db_path=result["database"])
    assert first["page"] == 1 and first["total_pages"] == 2
    assert first["url"].endswith("#page=1")
    assert first["next_offset"] == 30
    remainder = read_page("a", 1, offset=30, db_path=result["database"])
    complete = read_page("a", 1, db_path=result["database"])
    assert first["text"] + remainder["text"] == complete["text"]
    assert complete["text"].count("Revenue was 10 million.") == 8
    assert read_page("a", 2, db_path=result["database"])["next_offset"] is None
    for document_id, page in [("unknown", 1), ("../a", 1), ("a", 0), ("a", 3)]:
        with pytest.raises(ValueError):
            read_page(document_id, page, db_path=result["database"])
    with pytest.raises(ValueError):
        read_page("a", 1, offset=999999, db_path=result["database"])


def test_legacy_page_cache_cannot_escape_owned_directory(tmp_path):
    import sqlite3

    from agent.document_pages import read_page

    result = asyncio.run(prepare(inputs(tmp_path), tmp_path, embedder=vectors))
    with sqlite3.connect(result["database"]) as db:
        db.execute("DROP TABLE pages")
    cache = tmp_path / "pdfs"
    cache.mkdir()
    (cache / "a.pdf").symlink_to(tmp_path / "a.pdf")
    with pytest.raises(ValueError, match="Original page unavailable"):
        read_page("a", 1, db_path=result["database"])
    (cache / "a.pdf").unlink()
    pdf(cache / "a.pdf", ["Original page cache text. " * 5, "Second page."])
    assert (
        "Original page cache text"
        in read_page("a", 1, db_path=result["database"])["text"]
    )


def test_find_pages_normalizes_lines_and_preserves_document_scope(tmp_path):
    import sqlite3

    from agent.document_pages import find_pages

    result = asyncio.run(prepare(inputs(tmp_path), tmp_path, embedder=vectors))
    with sqlite3.connect(result["database"]) as db:
        db.execute(
            "UPDATE pages SET text=? WHERE document_id='a' AND page=1",
            ("Fiscal Year\n2025 Summary: Revenue 100",),
        )
        db.execute(
            "UPDATE pages SET text=? WHERE document_id='a' AND page=2",
            ("Fiscal Year 2025 Summary: Revenue 100",),
        )
    found = find_pages(
        "a", "fiscal year 2025 summary", limit=1, db_path=result["database"]
    )
    assert found["total_matches"] == 2
    assert [m["page"] for m in found["matches"]] == [1]
    assert find_pages("a", "%", db_path=result["database"])["matches"] == []
    for doc, phrase in [("unknown", "Revenue"), ("a", " ")]:
        with pytest.raises(ValueError):
            find_pages(doc, phrase, db_path=result["database"])
