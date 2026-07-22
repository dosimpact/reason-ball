from __future__ import annotations

from typing import Any

import pytest

from infrastructure.postgres.run_repository import PostgresRunRepository
from infrastructure.postgres.thread_repository import PostgresThreadRepository


class Cursor:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    async def fetchone(self):
        return self.rows[0] if self.rows else None

    async def fetchall(self):
        return self.rows


class Connection:
    def __init__(self) -> None:
        self.calls: list[tuple[str, Any]] = []
        self.results: list[list[dict[str, Any]]] = []

    async def execute(self, sql: str, params: Any = None) -> Cursor:
        self.calls.append((" ".join(sql.split()), params))
        return Cursor(self.results.pop(0) if self.results else [])


class ConnectionContext:
    def __init__(self, connection: Connection) -> None:
        self.connection = connection

    async def __aenter__(self) -> Connection:
        return self.connection

    async def __aexit__(self, *args) -> None:
        return None


class Pool:
    def __init__(self) -> None:
        self.connection_value = Connection()

    def connection(self) -> ConnectionContext:
        return ConnectionContext(self.connection_value)


def thread_row() -> dict[str, Any]:
    return {
        "thread_id": "00000000-0000-0000-0000-000000000001",
        "created_at": "2026-07-12T00:00:00Z",
        "updated_at": "2026-07-12T00:00:00Z",
        "state_updated_at": "2026-07-12T00:00:00Z",
        "metadata": {"tenant": "a"},
        "config": {},
        "status": "idle",
        "values": {"step": 1},
        "interrupts": {},
    }


def run_row() -> dict[str, Any]:
    return {
        "run_id": "00000000-0000-0000-0000-000000000002",
        "thread_id": "00000000-0000-0000-0000-000000000001",
        "assistant_id": "main_graph",
        "created_at": "2026-07-12T00:00:00Z",
        "updated_at": "2026-07-12T00:00:00Z",
        "status": "success",
        "metadata": {},
        "kwargs": {},
        "multitask_strategy": "enqueue",
        "result": {"ok": True},
    }


@pytest.mark.asyncio
async def test_thread_search_and_count_are_direct_normalized_queries() -> None:
    pool = Pool()
    repository = PostgresThreadRepository(pool)
    pool.connection_value.results = [[thread_row()], [{"count": 1}]]

    rows = await repository.search(
        {"metadata": {"tenant": "a"}, "values": {"step": 1}, "status": "idle"}
    )
    count = await repository.count({"metadata": {"tenant": "a"}})

    assert rows == [thread_row()]
    assert count == 1
    search_sql, search_params = pool.connection_value.calls[0]
    assert "FROM threads" in search_sql
    assert "metadata @> %s::jsonb" in search_sql
    assert "values @> %s::jsonb" in search_sql
    assert "LIMIT %s OFFSET %s" in search_sql
    assert search_params[-2:] == (10, 0)
    assert "SELECT count(*) AS count FROM threads" in pool.connection_value.calls[1][0]


@pytest.mark.asyncio
async def test_thread_upsert_and_delete_never_touch_checkpoint_tables() -> None:
    pool = Pool()
    repository = PostgresThreadRepository(pool)
    pool.connection_value.results = [[thread_row()], [{"thread_id": thread_row()["thread_id"]}]]

    await repository.upsert(thread_row())
    assert await repository.delete(thread_row()["thread_id"]) is True

    statements = " ".join(sql for sql, _ in pool.connection_value.calls).lower()
    assert "insert into threads" in statements
    assert "delete from threads" in statements
    assert "checkpoints" not in statements
    assert "checkpoint_writes" not in statements
    assert "checkpoint_blobs" not in statements


@pytest.mark.asyncio
async def test_run_lifecycle_is_upserted_and_listed_by_thread() -> None:
    pool = Pool()
    repository = PostgresRunRepository(pool)
    pool.connection_value.results = [[run_row()], [run_row()]]

    stored = await repository.upsert(run_row(), {"ok": True})
    listed = await repository.list_for_thread(run_row()["thread_id"], status="success")

    assert stored["status"] == "success"
    assert listed[0]["result"] == {"ok": True}
    assert "ON CONFLICT (run_id) DO UPDATE" in pool.connection_value.calls[0][0]
    assert "WHERE thread_id = %s AND status = %s" in pool.connection_value.calls[1][0]

