"""Normalized PostgreSQL persistence for LangGraph run lifecycle metadata."""

from __future__ import annotations

import json
from typing import Any


class PostgresRunRepository:
    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def get(self, run_id: str) -> dict[str, Any] | None:
        async with self.pool.connection() as connection:
            cursor = await connection.execute("SELECT * FROM runs WHERE run_id = %s", (run_id,))
            row = await cursor.fetchone()
            return dict(row) if row is not None else None

    async def list_all(self) -> list[dict[str, Any]]:
        async with self.pool.connection() as connection:
            cursor = await connection.execute("SELECT * FROM runs ORDER BY created_at")
            return [dict(row) for row in await cursor.fetchall()]

    async def list_for_thread(
        self, thread_id: str, *, limit: int = 10, offset: int = 0,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        sql = "SELECT * FROM runs WHERE thread_id = %s"
        params: list[Any] = [thread_id]
        if status:
            sql += " AND status = %s"
            params.append(status)
        sql += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        async with self.pool.connection() as connection:
            cursor = await connection.execute(sql, tuple(params))
            return [dict(row) for row in await cursor.fetchall()]

    async def upsert(self, run: dict[str, Any], result: Any = None) -> dict[str, Any]:
        params = (
            run["run_id"], run["thread_id"], run["assistant_id"], run["created_at"],
            run["updated_at"], run["status"], json.dumps(run.get("metadata") or {}),
            json.dumps(run.get("kwargs") or {}), run["multitask_strategy"],
            json.dumps(result) if result is not None else None,
        )
        sql = """
            INSERT INTO runs (
                run_id, thread_id, assistant_id, created_at, updated_at, status,
                metadata, kwargs, multitask_strategy, result
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb)
            ON CONFLICT (run_id) DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                status = EXCLUDED.status,
                metadata = EXCLUDED.metadata,
                kwargs = EXCLUDED.kwargs,
                multitask_strategy = EXCLUDED.multitask_strategy,
                result = COALESCE(EXCLUDED.result, runs.result)
            RETURNING *
        """
        async with self.pool.connection() as connection:
            cursor = await connection.execute(sql, params)
            return dict(await cursor.fetchone())

    async def delete(self, run_id: str) -> bool:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                "DELETE FROM runs WHERE run_id = %s RETURNING run_id", (run_id,)
            )
            return await cursor.fetchone() is not None

    async def delete_for_thread(self, thread_id: str) -> None:
        async with self.pool.connection() as connection:
            await connection.execute("DELETE FROM runs WHERE thread_id = %s", (thread_id,))

