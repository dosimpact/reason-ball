"""원문·섹션·수집 상태를 SQLite 트랜잭션으로 보관합니다."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime

from agent.documents import data_directory
from agent.sec.parsing import extract_sections


def now():
    return datetime.now(UTC).isoformat()


@contextmanager
def connection():
    root = data_directory()
    root.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(root / "sec.sqlite", timeout=20)
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE IF NOT EXISTS cache (
            url TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS filings (
            id TEXT PRIMARY KEY, cik TEXT NOT NULL, company TEXT NOT NULL,
            form TEXT NOT NULL, report_date TEXT NOT NULL, filed TEXT NOT NULL,
            url TEXT NOT NULL, status TEXT NOT NULL, error TEXT,
            text TEXT, sections TEXT, fetched_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS passages (
            id INTEGER PRIMARY KEY, filing_id TEXT NOT NULL, section TEXT NOT NULL,
            text TEXT NOT NULL, embedding BLOB NOT NULL);
        CREATE INDEX IF NOT EXISTS passage_filing ON passages(filing_id);
    """)
    try:
        with db:
            yield db
    finally:
        db.close()


def cached(url, max_age):
    with connection() as db:
        row = db.execute("SELECT * FROM cache WHERE url=?", (url,)).fetchone()
    if (
        row
        and (
            datetime.now(UTC) - datetime.fromisoformat(row["fetched_at"])
        ).total_seconds()
        < max_age
    ):
        return row["body"]
    return None


def cache(url, body):
    with connection() as db:
        db.execute("INSERT OR REPLACE INTO cache VALUES (?,?,?)", (url, body, now()))


def save_filing(filing, status, *, text=None, sections=None, error=None):
    with connection() as db:
        previous = db.execute(
            "SELECT status FROM filings WHERE id=?", (filing["id"],)
        ).fetchone()
        # 실패한 새 시도로 이미 확보한 원문을 덮어쓰지 않습니다.
        if (
            previous
            and previous["status"] in ("downloaded", "indexed")
            and status == "failed"
        ):
            return
        db.execute(
            """INSERT INTO filings VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET status=excluded.status,error=excluded.error,
            text=COALESCE(excluded.text,filings.text),sections=COALESCE(excluded.sections,filings.sections),
            fetched_at=excluded.fetched_at""",
            (
                filing["id"],
                filing["cik"],
                filing["company"],
                filing["form"],
                filing["report_date"],
                filing["filed"],
                filing["url"],
                status,
                error,
                text,
                json.dumps(sections, ensure_ascii=False)
                if sections is not None
                else None,
                now(),
            ),
        )


def filings(cik=None):
    with connection() as db:
        return [
            dict(r)
            for r in db.execute(
                "SELECT id,cik,company,form,report_date,filed,url,status,error,fetched_at FROM filings "
                + ("WHERE cik=? " if cik else "")
                + "ORDER BY report_date DESC,filed DESC",
                (cik,) if cik else (),
            )
        ]


def get_filing(filing_id):
    with connection() as db:
        row = db.execute("SELECT * FROM filings WHERE id=?", (filing_id,)).fetchone()
        if not row:
            raise ValueError("Unknown filing; collect it first")
        result = dict(row)
        result["sections"] = json.loads(result["sections"] or "{}")
        if (
            result["form"] in {"10-Q", "10-Q/A"}
            and result["status"] in {"downloaded", "indexed"}
            and any(key.startswith("Item ") for key in result["sections"])
        ):
            # Reparse the retained original, not the previously collapsed sections.
            result["sections"] = extract_sections(result["text"], result["form"])
            result["status"] = "downloaded"
            db.execute("DELETE FROM passages WHERE filing_id=?", (filing_id,))
            db.execute(
                "UPDATE filings SET sections=?,status='downloaded' WHERE id=?",
                (json.dumps(result["sections"], ensure_ascii=False), filing_id),
            )
        return result


def cached_at(url):
    with connection() as db:
        row = db.execute("SELECT fetched_at FROM cache WHERE url=?", (url,)).fetchone()
    return row["fetched_at"] if row else None
