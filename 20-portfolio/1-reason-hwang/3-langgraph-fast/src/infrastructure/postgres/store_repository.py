from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from psycopg.types.json import Jsonb


class PostgresStoreRepository:
    """Composite namespace/key persistence with database-enforced TTL."""

    def __init__(self, pool: Any) -> None:
        self.pool = pool

    @staticmethod
    def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
        if row is None:
            return None
        result = dict(row)
        for key in ("created_at", "updated_at"):
            if result.get(key) is not None and hasattr(result[key], "isoformat"):
                result[key] = result[key].isoformat()
        result.pop("index_config", None)
        result.pop("ttl_minutes", None)
        result.pop("expires_at", None)
        return result

    async def put(
        self,
        *,
        namespace: list[str],
        key: str,
        value: dict[str, Any],
        index: bool | list[str] | None,
        ttl: float | None,
    ) -> None:
        async with self.pool.connection() as connection:
            await connection.execute(
                """INSERT INTO store_items (
                    namespace, key, value, index_config, ttl_minutes, expires_at,
                    created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    CASE WHEN %s::double precision IS NULL THEN NULL
                         ELSE now() + (%s::double precision * interval '1 minute') END,
                    now(), now()
                ) ON CONFLICT (namespace, key) DO UPDATE SET
                    value = EXCLUDED.value,
                    index_config = EXCLUDED.index_config,
                    ttl_minutes = EXCLUDED.ttl_minutes,
                    expires_at = EXCLUDED.expires_at,
                    updated_at = now()""",
                (
                    namespace,
                    key,
                    Jsonb(value),
                    Jsonb(index),
                    ttl,
                    ttl,
                    ttl,
                ),
            )

    async def delete(self, *, namespace: list[str], key: str) -> None:
        async with self.pool.connection() as connection:
            await connection.execute(
                "DELETE FROM store_items WHERE namespace = %s AND key = %s",
                (namespace, key),
            )

    async def get(
        self, *, namespace: list[str], key: str, refresh_ttl: bool = False
    ) -> dict[str, Any] | None:
        async with self.pool.connection() as connection:
            await connection.execute(
                "DELETE FROM store_items WHERE expires_at IS NOT NULL AND expires_at <= now()"
            )
            if refresh_ttl:
                await connection.execute(
                    """UPDATE store_items
                    SET expires_at = now() + (ttl_minutes * interval '1 minute'),
                        updated_at = now()
                    WHERE namespace = %s AND key = %s AND ttl_minutes IS NOT NULL""",
                    (namespace, key),
                )
            cursor = await connection.execute(
                "SELECT * FROM store_items WHERE namespace = %s AND key = %s",
                (namespace, key),
            )
            row = await cursor.fetchone()
        return self._row(row)

    async def search(
        self,
        *,
        namespace_prefix: list[str] | None,
        filter: dict[str, Any] | None,
        query: str | None,
        limit: int,
        offset: int,
        refresh_ttl: bool = False,
    ) -> list[dict[str, Any]]:
        clauses = ["(expires_at IS NULL OR expires_at > now())"]
        params: list[Any] = []
        prefix = namespace_prefix or []
        if prefix:
            clauses.append("namespace[1:cardinality(%s::text[])] = %s::text[]")
            params.extend((prefix, prefix))
        if filter:
            clauses.append("value @> %s")
            params.append(Jsonb(filter))
        if query:
            clauses.append("value::text ILIKE %s")
            params.append(f"%{query}%")
        where = " AND ".join(clauses)
        params.extend((max(limit, 0), max(offset, 0)))
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                f"SELECT * FROM store_items WHERE {where} ORDER BY updated_at DESC LIMIT %s OFFSET %s",
                tuple(params),
            )
            rows = await cursor.fetchall()
            if refresh_ttl:
                for row in rows:
                    await connection.execute(
                        """UPDATE store_items
                        SET expires_at = now() + (ttl_minutes * interval '1 minute'),
                            updated_at = now()
                        WHERE namespace = %s AND key = %s AND ttl_minutes IS NOT NULL""",
                        (row["namespace"], row["key"]),
                    )
        return [value for row in rows if (value := self._row(row)) is not None]

    async def list_namespaces(
        self,
        *,
        prefix: list[str] | None,
        suffix: list[str] | None,
        max_depth: int | None,
        limit: int,
        offset: int,
    ) -> list[list[str]]:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                """SELECT DISTINCT namespace FROM store_items
                WHERE expires_at IS NULL OR expires_at > now()"""
            )
            rows = await cursor.fetchall()
        prefix_tuple, suffix_tuple = tuple(prefix or []), tuple(suffix or [])
        namespaces = []
        for row in rows:
            namespace = tuple(row["namespace"])
            if namespace[: len(prefix_tuple)] != prefix_tuple:
                continue
            if suffix_tuple and namespace[-len(suffix_tuple) :] != suffix_tuple:
                continue
            namespaces.append(namespace[:max_depth] if max_depth is not None else namespace)
        selected = sorted(set(namespaces))[max(offset, 0) : max(offset, 0) + max(limit, 0)]
        return [list(namespace) for namespace in selected]
