"""Read original PDF page text without semantic search or another embedding call."""

import asyncio
import json
import re
from pathlib import Path

from langchain_core.tools import tool
from pypdf import PdfReader

from agent.documents import data_directory, open_database


def read_page(document_id, page, offset=0, limit=16000, *, db_path=None):
    if (
        not isinstance(page, int)
        or page < 1
        or not 0 <= offset
        or not 1 <= limit <= 20000
    ):
        raise ValueError(
            "Expected positive page, nonnegative offset, and limit 1..20000"
        )
    db = open_database(db_path)
    try:
        document = db.execute(
            "SELECT * FROM documents WHERE id=?", (document_id,)
        ).fetchone()
        if not document:
            raise ValueError("Unknown document ID; use the document catalog")
        if page > document["pages"]:
            raise ValueError("Page exceeds document page count")
        has_pages = db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='pages'"
        ).fetchone()
        row = (
            db.execute(
                "SELECT text FROM pages WHERE document_id=? AND page=?",
                (document_id, page),
            ).fetchone()
            if has_pages
            else None
        )
        text = row["text"] if row else None
        metadata = dict(document)
    finally:
        db.close()
    if text is None:
        # Legacy indexes have no page table. Only their backend-owned PDF cache is eligible.
        if not re.fullmatch(r"[A-Za-z0-9_-]+", document_id):
            raise ValueError("Original page unavailable; prepare documents again")
        directory = (Path(db_path).parent if db_path else data_directory()) / "pdfs"
        path = (directory / f"{document_id}.pdf").resolve()
        if not path.is_relative_to(directory.resolve()) or not path.is_file():
            raise ValueError("Original page unavailable; prepare documents again")
        text = PdfReader(path).pages[page - 1].extract_text() or ""
    if offset > len(text):
        raise ValueError("Offset exceeds page text length")
    end = min(len(text), offset + limit)
    return {
        "document_id": document_id,
        "document": metadata["name"],
        "period": metadata["period"],
        "page": page,
        "total_pages": metadata["pages"],
        "text": text[offset:end],
        "offset": offset,
        "next_offset": end if end < len(text) else None,
        "url": f"{metadata['url']}#page={page}" if metadata["url"] else None,
        "text_available": bool(text.strip()),
    }


@tool
async def read_document_page(
    document_id: str, page: int, offset: int = 0, limit: int = 16000
) -> str:
    """Read original text from a prepared PDF page. Search first to locate the section/page.

    Page is 1-based. Follow next_offset to finish a long page. Read subsequent pages as needed.
    This returns original extracted text, not a summary or search snippet. Cite the returned page URL.
    Empty text may require OCR; do not invent content. Never describe a single page as the full report.
    """
    try:
        return json.dumps(
            await asyncio.to_thread(read_page, document_id, page, offset, limit),
            ensure_ascii=False,
        )
    except Exception as exc:  # noqa: BLE001 - keep filesystem/provider internals out of chat
        return json.dumps(
            {
                "success": False,
                "error": type(exc).__name__,
                "message": "Cannot read that original PDF page. Check document ID/page or prepare documents again; use available searched passages with their limited scope.",
            }
        )


def find_pages(document_id, phrase, limit=8, *, db_path=None):
    phrase = phrase.strip()
    if not phrase or len(phrase) > 200 or not 1 <= limit <= 20:
        raise ValueError("Use a phrase of 1..200 characters and limit 1..20")
    db = open_database(db_path)
    try:
        if not db.execute(
            "SELECT 1 FROM documents WHERE id=?", (document_id,)
        ).fetchone():
            raise ValueError("Unknown document ID")
        rows = db.execute(
            "SELECT page,text FROM pages WHERE document_id=? ORDER BY page",
            (document_id,),
        )
        hits = []
        for row in rows:
            text = re.sub(r"\s+", " ", row["text"])
            position = text.casefold().find(phrase.casefold())
            if position >= 0:
                hits.append(
                    {
                        "page": row["page"],
                        "excerpt": text[
                            max(0, position - 80) : position + len(phrase) + 240
                        ],
                    }
                )
        return {
            "document_id": document_id,
            "phrase": phrase,
            "total_matches": len(hits),
            "matches": hits[:limit],
        }
    finally:
        db.close()


@tool
async def find_document_pages(document_id: str, phrase: str, limit: int = 8) -> str:
    """Find actual PDF page numbers containing an exact phrase, ignoring case/line breaks.

    Use English headings such as 'Fiscal Year 2025 Summary' or 'Consolidated Statements'.
    Use this before guessing page numbers. Read returned pages with read_document_page.
    This locates excerpts, not proof that the full page or report has been read.
    """
    try:
        return json.dumps(
            await asyncio.to_thread(find_pages, document_id, phrase, limit),
            ensure_ascii=False,
        )
    except (ValueError, FileNotFoundError) as exc:
        return json.dumps({"success": False, "error": str(exc)})
