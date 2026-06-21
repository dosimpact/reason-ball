from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from parser.core.config import AppConfig, get_settings


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class RuntimeThread:
    thread_id: str
    assistant_id: str
    state: dict[str, Any]
    created_at: str
    updated_at: str


@dataclass
class RuntimeRun:
    run_id: str
    thread_id: str
    status: str
    request: dict[str, Any]
    response_text: str
    created_at: str
    updated_at: str


class RuntimeStore:
    def __init__(self, settings: AppConfig | None = None) -> None:
        self.settings = settings or get_settings()
        self.db_path = Path(self.settings.runtime_db_path)
        self.max_threads = max(1, self.settings.runtime_store_max_threads)
        self.retention_days = max(1, self.settings.runtime_store_retention_days)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self.cleanup()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS runtime_thread (
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
                CREATE TABLE IF NOT EXISTS runtime_run (
                  run_id TEXT PRIMARY KEY,
                  thread_id TEXT NOT NULL REFERENCES runtime_thread(thread_id) ON DELETE CASCADE,
                  status TEXT NOT NULL,
                  request_json TEXT NOT NULL,
                  response_text TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                )
                """
            )
            if not self._has_thread_cascade_locked(conn):
                self._migrate_runtime_run_with_cascade_locked(conn)
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_runtime_run_thread_id_created_at
                ON runtime_run(thread_id, created_at DESC)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_runtime_thread_updated_at
                ON runtime_thread(updated_at ASC, thread_id ASC)
                """
            )

    def stats(self) -> dict[str, Any]:
        with self._connect() as conn:
            self._cleanup_locked(conn)
            thread_count = conn.execute("SELECT COUNT(*) FROM runtime_thread").fetchone()[0]
            run_count = conn.execute("SELECT COUNT(*) FROM runtime_run").fetchone()[0]
            foreign_key_cascade = self._has_thread_cascade_locked(conn)
        return {
            "dbPath": str(self.db_path),
            "threads": int(thread_count),
            "runs": int(run_count),
            "maxThreads": self.max_threads,
            "retentionDays": self.retention_days,
            "foreignKeyCascade": foreign_key_cascade,
        }

    def cleanup(self) -> None:
        with self._connect() as conn:
            self._cleanup_locked(conn)

    def create_thread(
        self,
        assistant_id: str,
        initial_state: dict[str, Any] | None = None,
        thread_id: str | None = None,
    ) -> RuntimeThread:
        now = utc_now()
        thread = RuntimeThread(
            thread_id=thread_id or str(uuid.uuid4()),
            assistant_id=assistant_id,
            state=initial_state or {"messages": [], "selected_filing": None, "evidence_bundle": []},
            created_at=now,
            updated_at=now,
        )
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO runtime_thread(thread_id, assistant_id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (thread.thread_id, thread.assistant_id, json.dumps(thread.state), thread.created_at, thread.updated_at),
            )
            self._cleanup_locked(conn)
        return thread

    def get_thread(self, thread_id: str) -> RuntimeThread | None:
        with self._connect() as conn:
            self._cleanup_locked(conn)
            row = conn.execute(
                "SELECT thread_id, assistant_id, state_json, created_at, updated_at FROM runtime_thread WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
        if row is None:
            return None
        return RuntimeThread(
            thread_id=row["thread_id"],
            assistant_id=row["assistant_id"],
            state=json.loads(row["state_json"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def update_thread_state(self, thread_id: str, state: dict[str, Any]) -> RuntimeThread:
        existing = self.get_thread(thread_id)
        if existing is None:
            raise KeyError(f"thread not found: {thread_id}")
        updated_at = utc_now()
        with self._connect() as conn:
            conn.execute(
                "UPDATE runtime_thread SET state_json = ?, updated_at = ? WHERE thread_id = ?",
                (json.dumps(state), updated_at, thread_id),
            )
            self._cleanup_locked(conn)
        return RuntimeThread(
            thread_id=existing.thread_id,
            assistant_id=existing.assistant_id,
            state=state,
            created_at=existing.created_at,
            updated_at=updated_at,
        )

    def create_run(self, thread_id: str, request: dict[str, Any]) -> RuntimeRun:
        now = utc_now()
        run = RuntimeRun(
            run_id=str(uuid.uuid4()),
            thread_id=thread_id,
            status="running",
            request=request,
            response_text="",
            created_at=now,
            updated_at=now,
        )
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO runtime_run(run_id, thread_id, status, request_json, response_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (run.run_id, run.thread_id, run.status, json.dumps(run.request), run.response_text, run.created_at, run.updated_at),
            )
            self._cleanup_locked(conn)
        return run

    def finish_run(self, run_id: str, status: str, response_text: str) -> RuntimeRun:
        updated_at = utc_now()
        with self._connect() as conn:
            conn.execute(
                "UPDATE runtime_run SET status = ?, response_text = ?, updated_at = ? WHERE run_id = ?",
                (status, response_text, updated_at, run_id),
            )
            row = conn.execute(
                "SELECT run_id, thread_id, status, request_json, response_text, created_at, updated_at FROM runtime_run WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            self._cleanup_locked(conn)
        if row is None:
            raise KeyError(f"run not found: {run_id}")
        return RuntimeRun(
            run_id=row["run_id"],
            thread_id=row["thread_id"],
            status=row["status"],
            request=json.loads(row["request_json"]),
            response_text=row["response_text"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def get_run(self, run_id: str) -> RuntimeRun | None:
        with self._connect() as conn:
            self._cleanup_locked(conn)
            row = conn.execute(
                "SELECT run_id, thread_id, status, request_json, response_text, created_at, updated_at FROM runtime_run WHERE run_id = ?",
                (run_id,),
            ).fetchone()
        if row is None:
            return None
        return RuntimeRun(
            run_id=row["run_id"],
            thread_id=row["thread_id"],
            status=row["status"],
            request=json.loads(row["request_json"]),
            response_text=row["response_text"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def get_latest_run_for_thread(self, thread_id: str) -> RuntimeRun | None:
        with self._connect() as conn:
            self._cleanup_locked(conn)
            row = conn.execute(
                """
                SELECT run_id, thread_id, status, request_json, response_text, created_at, updated_at
                FROM runtime_run
                WHERE thread_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (thread_id,),
            ).fetchone()
        if row is None:
            return None
        return RuntimeRun(
            run_id=row["run_id"],
            thread_id=row["thread_id"],
            status=row["status"],
            request=json.loads(row["request_json"]),
            response_text=row["response_text"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _cleanup_locked(self, conn: sqlite3.Connection) -> None:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=self.retention_days)).isoformat()
        expired_thread_ids = [
            row["thread_id"]
            for row in conn.execute(
                "SELECT thread_id FROM runtime_thread WHERE updated_at < ?",
                (cutoff,),
            ).fetchall()
        ]
        self._delete_threads_locked(conn, expired_thread_ids)

        thread_count = conn.execute("SELECT COUNT(*) FROM runtime_thread").fetchone()[0]
        overflow = int(thread_count) - self.max_threads
        if overflow <= 0:
            return

        overflow_thread_ids = [
            row["thread_id"]
            for row in conn.execute(
                """
                SELECT thread_id
                FROM runtime_thread
                ORDER BY updated_at ASC, thread_id ASC
                LIMIT ?
                """,
                (overflow,),
            ).fetchall()
        ]
        self._delete_threads_locked(conn, overflow_thread_ids)

    @staticmethod
    def _delete_threads_locked(conn: sqlite3.Connection, thread_ids: list[str]) -> None:
        for thread_id in thread_ids:
            conn.execute("DELETE FROM runtime_thread WHERE thread_id = ?", (thread_id,))

    @staticmethod
    def _has_thread_cascade_locked(conn: sqlite3.Connection) -> bool:
        return any(
            row["table"] == "runtime_thread"
            and row["from"] == "thread_id"
            and str(row["on_delete"]).upper() == "CASCADE"
            for row in conn.execute("PRAGMA foreign_key_list(runtime_run)").fetchall()
        )

    def _migrate_runtime_run_with_cascade_locked(self, conn: sqlite3.Connection) -> None:
        conn.execute("DROP TABLE IF EXISTS runtime_run_next")
        conn.execute(
            """
            CREATE TABLE runtime_run_next (
              run_id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL REFERENCES runtime_thread(thread_id) ON DELETE CASCADE,
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
            INSERT INTO runtime_run_next(
              run_id,
              thread_id,
              status,
              request_json,
              response_text,
              created_at,
              updated_at
            )
            SELECT
              runtime_run.run_id,
              runtime_run.thread_id,
              runtime_run.status,
              runtime_run.request_json,
              runtime_run.response_text,
              runtime_run.created_at,
              runtime_run.updated_at
            FROM runtime_run
            INNER JOIN runtime_thread
              ON runtime_thread.thread_id = runtime_run.thread_id
            """
        )
        conn.execute("DROP TABLE runtime_run")
        conn.execute("ALTER TABLE runtime_run_next RENAME TO runtime_run")
