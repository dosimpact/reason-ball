"""Normalized PostgreSQL persistence for LangGraph thread metadata."""

from __future__ import annotations

import json
from typing import Any


def _mapping(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


class PostgresThreadRepository:
    """Async repository backed by an existing psycopg AsyncConnectionPool."""

    _sort_columns = {
        "thread_id", "status", "created_at", "updated_at", "state_updated_at"
    }

    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def get(self, thread_id: str) -> dict[str, Any] | None:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                "SELECT * FROM threads WHERE thread_id = %s", (thread_id,)
            )
            return _mapping(await cursor.fetchone())

    async def list_all(self) -> list[dict[str, Any]]:
        async with self.pool.connection() as connection:
            cursor = await connection.execute("SELECT * FROM threads ORDER BY created_at")
            return [dict(row) for row in await cursor.fetchall()]

    async def upsert(self, thread: dict[str, Any]) -> dict[str, Any]:
        values = (
            thread["thread_id"], thread["created_at"], thread["updated_at"],
            thread.get("state_updated_at"), json.dumps(thread.get("metadata") or {}),
            json.dumps(thread.get("config") or {}), thread["status"],
            json.dumps(thread.get("values") or {}), json.dumps(thread.get("interrupts") or {}),
            json.dumps(thread["ttl"]) if thread.get("ttl") is not None else None,
        )
        sql = """
            INSERT INTO threads (
                thread_id, created_at, updated_at, state_updated_at, metadata,
                config, status, values, interrupts, ttl
            ) VALUES (
                %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s::jsonb, %s::jsonb
            )
            ON CONFLICT (thread_id) DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                state_updated_at = EXCLUDED.state_updated_at,
                metadata = EXCLUDED.metadata,
                config = EXCLUDED.config,
                status = EXCLUDED.status,
                values = EXCLUDED.values,
                interrupts = EXCLUDED.interrupts,
                ttl = EXCLUDED.ttl
            RETURNING *
        """
        async with self.pool.connection() as connection:
            cursor = await connection.execute(sql, values)
            return dict(await cursor.fetchone())

    async def search(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if filters.get("ids"):
            clauses.append("thread_id = ANY(%s::uuid[])")
            params.append(filters["ids"])
        if filters.get("status"):
            clauses.append("status = %s")
            params.append(filters["status"])
        for field in ("metadata", "values"):
            if filters.get(field):
                clauses.append(f"{field} @> %s::jsonb")
                params.append(json.dumps(filters[field]))
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        sort_by = filters.get("sort_by", "created_at")
        if sort_by not in self._sort_columns:
            sort_by = "created_at"
        order = "ASC" if filters.get("sort_order") == "asc" else "DESC"
        params.extend([filters.get("limit", 10), filters.get("offset", 0)])
        sql = f"SELECT * FROM threads{where} ORDER BY {sort_by} {order} LIMIT %s OFFSET %s"
        async with self.pool.connection() as connection:
            cursor = await connection.execute(sql, tuple(params))
            return [dict(row) for row in await cursor.fetchall()]

    async def count(self, filters: dict[str, Any]) -> int:
        clauses: list[str] = []
        params: list[Any] = []
        if filters.get("status"):
            clauses.append("status = %s")
            params.append(filters["status"])
        for field in ("metadata", "values"):
            if filters.get(field):
                clauses.append(f"{field} @> %s::jsonb")
                params.append(json.dumps(filters[field]))
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                f"SELECT count(*) AS count FROM threads{where}", tuple(params)
            )
            row = await cursor.fetchone()
            return int(dict(row)["count"])

    async def delete(self, thread_id: str) -> bool:
        # Intentionally touches only the normalized application table. LangGraph's
        # checkpoints/checkpoint_writes/checkpoint_blobs are never cascaded here.
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                "DELETE FROM threads WHERE thread_id = %s RETURNING thread_id", (thread_id,)
            )
            return await cursor.fetchone() is not None

