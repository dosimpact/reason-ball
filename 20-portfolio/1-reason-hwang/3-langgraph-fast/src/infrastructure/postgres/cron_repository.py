from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb


class PostgresCronRepository:
    """Row-oriented persistence for the normalized ``crons`` table."""

    _SORT_COLUMNS = {
        "cron_id",
        "assistant_id",
        "thread_id",
        "next_run_date",
        "end_time",
        "created_at",
        "updated_at",
    }

    def __init__(self, pool: Any) -> None:
        self.pool = pool

    @staticmethod
    def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
        if row is None:
            return None
        result = dict(row)
        for key in ("cron_id", "assistant_id", "thread_id"):
            if result.get(key) is not None:
                result[key] = str(result[key])
        for key in ("end_time", "created_at", "updated_at", "next_run_date"):
            if result.get(key) is not None and hasattr(result[key], "isoformat"):
                result[key] = result[key].isoformat()
        return result

    async def create(self, cron: dict[str, Any]) -> dict[str, Any]:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                """INSERT INTO crons (
                    cron_id, assistant_id, thread_id, schedule, timezone, enabled,
                    payload, next_run_date, end_time, metadata, user_id,
                    created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING *""",
                (
                    cron["cron_id"],
                    cron.get("assistant_id"),
                    cron["thread_id"],
                    cron["schedule"],
                    cron.get("payload", {}).get("timezone"),
                    cron["enabled"],
                    Jsonb(cron["payload"]),
                    cron.get("next_run_date"),
                    cron.get("end_time"),
                    Jsonb(cron.get("metadata", {})),
                    cron.get("user_id"),
                    cron["created_at"],
                    cron["updated_at"],
                ),
            )
            row = await cursor.fetchone()
        return self._row(row) or cron

    async def get(self, cron_id: UUID) -> dict[str, Any] | None:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                "SELECT * FROM crons WHERE cron_id = %s", (cron_id,)
            )
            row = await cursor.fetchone()
        return self._row(row)

    @staticmethod
    def _filters(
        *,
        assistant_id: str | None,
        thread_id: UUID | None,
        enabled: bool | None,
        metadata: dict[str, Any] | None,
    ) -> tuple[str, list[Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if assistant_id is not None:
            clauses.append("assistant_id = %s")
            params.append(assistant_id)
        if thread_id is not None:
            clauses.append("thread_id = %s")
            params.append(thread_id)
        if enabled is not None:
            clauses.append("enabled = %s")
            params.append(enabled)
        if metadata:
            clauses.append("metadata @> %s")
            params.append(Jsonb(metadata))
        return (" WHERE " + " AND ".join(clauses) if clauses else ""), params

    async def search(
        self,
        *,
        assistant_id: str | None = None,
        thread_id: UUID | None = None,
        enabled: bool | None = None,
        metadata: dict[str, Any] | None = None,
        limit: int = 10,
        offset: int = 0,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> list[dict[str, Any]]:
        where, params = self._filters(
            assistant_id=assistant_id,
            thread_id=thread_id,
            enabled=enabled,
            metadata=metadata,
        )
        column = sort_by if sort_by in self._SORT_COLUMNS else "created_at"
        direction = "ASC" if sort_order == "asc" else "DESC"
        params.extend((limit, offset))
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                f"SELECT * FROM crons{where} ORDER BY {column} {direction} LIMIT %s OFFSET %s",
                tuple(params),
            )
            rows = await cursor.fetchall()
        return [value for row in rows if (value := self._row(row)) is not None]

    async def count(
        self,
        *,
        assistant_id: str | None = None,
        thread_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> int:
        where, params = self._filters(
            assistant_id=assistant_id,
            thread_id=thread_id,
            enabled=None,
            metadata=metadata,
        )
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                f"SELECT count(*) AS count FROM crons{where}", tuple(params)
            )
            row = await cursor.fetchone()
        return int(row["count"] if isinstance(row, Mapping) else row[0])

    async def update(self, cron: dict[str, Any]) -> dict[str, Any]:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                """UPDATE crons SET schedule = %s, timezone = %s, enabled = %s,
                    payload = %s, end_time = %s, metadata = %s, updated_at = %s
                WHERE cron_id = %s RETURNING *""",
                (
                    cron["schedule"],
                    cron.get("payload", {}).get("timezone"),
                    cron["enabled"],
                    Jsonb(cron["payload"]),
                    cron.get("end_time"),
                    Jsonb(cron.get("metadata", {})),
                    cron["updated_at"],
                    cron["cron_id"],
                ),
            )
            row = await cursor.fetchone()
        return self._row(row) or cron

    async def delete(self, cron_id: UUID) -> bool:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                "DELETE FROM crons WHERE cron_id = %s RETURNING cron_id", (cron_id,)
            )
            return await cursor.fetchone() is not None
