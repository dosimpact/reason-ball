from __future__ import annotations

import sqlite3
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from requests import Response

from parser.collector.client import CollectorClient
from parser.core.config import AppConfig
from parser.runtime.store import RuntimeStore


def runtime_settings(
    db_path: Path,
    *,
    max_threads: int = 10,
    retention_days: int = 9_999,
) -> AppConfig:
    return replace(
        AppConfig.from_env(),
        runtime_db_path=db_path,
        runtime_store_max_threads=max_threads,
        runtime_store_retention_days=retention_days,
    )


def assert_runtime_run_cascade(conn: sqlite3.Connection) -> None:
    foreign_keys = conn.execute("PRAGMA foreign_key_list(runtime_run)").fetchall()
    assert any(
        row[2] == "runtime_thread" and row[3] == "thread_id" and str(row[6]).upper() == "CASCADE"
        for row in foreign_keys
    ), foreign_keys


def assert_runtime_indexes(conn: sqlite3.Connection) -> None:
    run_indexes = {row[1] for row in conn.execute("PRAGMA index_list(runtime_run)").fetchall()}
    thread_indexes = {row[1] for row in conn.execute("PRAGMA index_list(runtime_thread)").fetchall()}
    assert "idx_runtime_run_thread_id_created_at" in run_indexes, run_indexes
    assert "idx_runtime_thread_updated_at" in thread_indexes, thread_indexes


def fresh_schema_smoke() -> None:
    with TemporaryDirectory(prefix="parser-runtime-fresh-") as tmp_dir:
        db_path = Path(tmp_dir) / "runtime.db"
        store = RuntimeStore(runtime_settings(db_path))
        thread = store.create_thread("assistant")
        run = store.create_run(thread.thread_id, {"message": "schema smoke"})

        assert store.get_run(run.run_id) is not None
        assert store.stats()["foreignKeyCascade"] is True

        with sqlite3.connect(db_path) as conn:
            conn.execute("PRAGMA foreign_keys = ON")
            assert_runtime_run_cascade(conn)
            assert_runtime_indexes(conn)
            conn.execute("DELETE FROM runtime_thread WHERE thread_id = ?", (thread.thread_id,))
            remaining = conn.execute(
                "SELECT COUNT(*) FROM runtime_run WHERE run_id = ?",
                (run.run_id,),
            ).fetchone()[0]
            assert remaining == 0

    print("runtime_store_fresh_schema_smoke=pass")


def seed_legacy_runtime_schema(db_path: Path) -> None:
    now = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE runtime_thread (
              thread_id TEXT PRIMARY KEY,
              assistant_id TEXT NOT NULL,
              state_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE runtime_run (
              run_id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL,
              status TEXT NOT NULL,
              request_json TEXT NOT NULL,
              response_text TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            INSERT INTO runtime_thread(
              thread_id,
              assistant_id,
              state_json,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?)
            """,
            ("old-thread", "assistant", "{}", now, now),
        )
        conn.execute(
            """
            INSERT INTO runtime_run(
              run_id,
              thread_id,
              status,
              request_json,
              response_text,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            ("old-run", "old-thread", "completed", "{}", "ok", now, now),
        )
        conn.execute(
            """
            INSERT INTO runtime_run(
              run_id,
              thread_id,
              status,
              request_json,
              response_text,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            ("orphan-run", "missing-thread", "completed", "{}", "orphan", now, now),
        )
        conn.commit()
    finally:
        conn.close()


def legacy_migration_smoke() -> None:
    with TemporaryDirectory(prefix="parser-runtime-migration-") as tmp_dir:
        db_path = Path(tmp_dir) / "runtime.db"
        seed_legacy_runtime_schema(db_path)

        store = RuntimeStore(runtime_settings(db_path))
        assert store.get_run("old-run") is not None
        assert store.get_run("orphan-run") is None
        assert store.stats()["foreignKeyCascade"] is True

        with sqlite3.connect(db_path) as conn:
            conn.execute("PRAGMA foreign_keys = ON")
            assert_runtime_run_cascade(conn)
            assert_runtime_indexes(conn)
            conn.execute("DELETE FROM runtime_thread WHERE thread_id = ?", ("old-thread",))
            remaining = conn.execute(
                "SELECT COUNT(*) FROM runtime_run WHERE run_id = ?",
                ("old-run",),
            ).fetchone()[0]
            assert remaining == 0

    print("runtime_store_legacy_migration_smoke=pass")


def collector_request_id_smoke() -> None:
    client = CollectorClient("http://collector.example", correlation_id="req-smoke")
    headers = client._headers()
    assert headers["x-request-id"] == "req-smoke"

    response = Response()
    response.headers["x-request-id"] = "req-smoke"
    client._record_response_request_id(response)
    assert client.response_request_ids == ["req-smoke"]

    print("collector_client_request_id_smoke=pass")


def collector_downloaded_reports_parser_status_smoke() -> None:
    captured: dict[str, object] = {}

    class FakeSession:
        def get(self, url, *, params, headers, timeout):  # noqa: ANN001
            captured["url"] = url
            captured["params"] = params
            captured["headers"] = headers
            captured["timeout"] = timeout

            response = Response()
            response.status_code = 200
            response.headers["x-request-id"] = "req-smoke"
            response._content = b'{"items":[],"pagination":{"page":1,"pageSize":5,"totalItems":0,"totalPages":0,"hasNextPage":false}}'
            return response

    client = CollectorClient("http://collector.example", correlation_id="req-smoke")
    client.session = FakeSession()  # type: ignore[assignment]

    result = client.list_downloaded_reports(parser_status="")
    assert result["items"] == []
    assert captured["params"]["parserStatus"] == ""  # type: ignore[index]
    assert client.response_request_ids == ["req-smoke"]

    print("collector_downloaded_reports_parser_status_smoke=pass")


def main() -> None:
    fresh_schema_smoke()
    legacy_migration_smoke()
    collector_request_id_smoke()
    collector_downloaded_reports_parser_status_smoke()


if __name__ == "__main__":
    main()
