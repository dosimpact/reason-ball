from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from psycopg.types.json import Jsonb


class PostgresA2ATaskRepository:
    """Durable task lookup for the A2A JSON-RPC endpoint."""

    def __init__(self, pool: Any) -> None:
        self.pool = pool

    async def save(self, task: dict[str, Any]) -> dict[str, Any]:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                """INSERT INTO a2a_tasks (
                    task_id, assistant_id, context_id, status, payload,
                    created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, now(), now())
                ON CONFLICT (task_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    payload = EXCLUDED.payload,
                    updated_at = now()
                RETURNING payload""",
                (
                    task["id"],
                    task.get("assistantId"),
                    task.get("contextId"),
                    task.get("status", {}).get("state", "unknown"),
                    Jsonb(task),
                ),
            )
            row = await cursor.fetchone()
        payload = row.get("payload") if isinstance(row, Mapping) else row[0] if row else None
        return payload if isinstance(payload, dict) else task

    async def get(self, task_id: str) -> dict[str, Any] | None:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                "SELECT payload FROM a2a_tasks WHERE task_id = %s", (task_id,)
            )
            row = await cursor.fetchone()
        payload = row.get("payload") if isinstance(row, Mapping) else row[0] if row else None
        return payload if isinstance(payload, dict) else None
