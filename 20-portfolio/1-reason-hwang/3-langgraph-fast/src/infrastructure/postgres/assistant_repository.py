"""Async PostgreSQL repository for Assistant identity and immutable versions."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID, uuid4

from psycopg.types.json import Jsonb

from server.assistants.models import (
    Assistant,
    AssistantCountRequest,
    AssistantCreate,
    AssistantPatch,
    AssistantSearchRequest,
    AssistantVersionsSearchRequest,
)
from server.assistants.repository import (
    AssistantAlreadyExistsError,
    AssistantNotFoundError,
    AssistantVersionNotFoundError,
)


class PostgresAssistantRepository:
    """Persist all Assistant changes transactionally using an async psycopg pool."""

    _selectable = {
        "assistant_id", "graph_id", "name", "description", "config", "context",
        "created_at", "updated_at", "metadata", "version",
    }
    _sortable = {"assistant_id", "created_at", "updated_at", "name", "graph_id"}

    def __init__(self, pool: Any) -> None:
        self.pool = pool

    @staticmethod
    def _assistant(row: Mapping[str, Any]) -> Assistant:
        values = dict(row)
        values["version"] = values.pop("latest_version", values.get("version", 1))
        return Assistant.model_validate(values)

    async def create(self, payload: AssistantCreate) -> Assistant:
        assistant_id = payload.assistant_id or uuid4()
        async with self.pool.connection() as connection:
            async with connection.transaction():
                cursor = await connection.execute(
                    "SELECT * FROM assistants WHERE assistant_id=%s FOR UPDATE",
                    (assistant_id,),
                )
                existing = await cursor.fetchone()
                if existing is not None:
                    if payload.if_exists == "do_nothing":
                        return self._assistant(existing)
                    raise AssistantAlreadyExistsError(str(assistant_id))
                cursor = await connection.execute(
                    """INSERT INTO assistants
                    (assistant_id,latest_version,graph_id,config,context,metadata,name,description,created_at,updated_at)
                    VALUES (%s,1,%s,%s,%s,%s,%s,%s,now(),now()) RETURNING *""",
                    (
                        assistant_id, payload.graph_id, Jsonb(payload.config),
                        Jsonb(payload.context), Jsonb(payload.metadata), payload.name,
                        payload.description,
                    ),
                )
                row = await cursor.fetchone()
                await connection.execute(
                    """INSERT INTO assistant_versions
                    (assistant_id,version,graph_id,config,context,metadata,name,description,created_at,updated_at)
                    SELECT assistant_id,1,graph_id,config,context,metadata,name,description,created_at,updated_at
                    FROM assistants WHERE assistant_id=%s""",
                    (assistant_id,),
                )
                return self._assistant(row)

    async def get(self, assistant_id: UUID) -> Assistant:
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                "SELECT * FROM assistants WHERE assistant_id=%s", (assistant_id,)
            )
            row = await cursor.fetchone()
        if row is None:
            raise AssistantNotFoundError(str(assistant_id))
        return self._assistant(row)

    async def patch(self, assistant_id: UUID, payload: AssistantPatch) -> Assistant:
        async with self.pool.connection() as connection:
            async with connection.transaction():
                cursor = await connection.execute(
                    "SELECT * FROM assistants WHERE assistant_id=%s FOR UPDATE",
                    (assistant_id,),
                )
                row = await cursor.fetchone()
                if row is None:
                    raise AssistantNotFoundError(str(assistant_id))
                current = self._assistant(row)
                changes = payload.model_dump(exclude_unset=True)
                metadata = (
                    {**current.metadata, **changes["metadata"]}
                    if "metadata" in changes else current.metadata
                )
                cursor = await connection.execute(
                    "SELECT COALESCE(MAX(version),0)+1 AS version FROM assistant_versions WHERE assistant_id=%s",
                    (assistant_id,),
                )
                version_row = await cursor.fetchone()
                version = int(version_row["version"] if isinstance(version_row, Mapping) else version_row[0])
                graph_id = changes.get("graph_id", current.graph_id)
                config = changes.get("config", current.config)
                context = changes.get("context", current.context)
                name = changes.get("name", current.name)
                description = changes.get("description", current.description)
                await connection.execute(
                    """INSERT INTO assistant_versions
                    (assistant_id,version,graph_id,config,context,metadata,name,description,created_at,updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,now())""",
                    (
                        assistant_id, version, graph_id, Jsonb(config), Jsonb(context),
                        Jsonb(metadata), name, description, current.created_at,
                    ),
                )
                cursor = await connection.execute(
                    """UPDATE assistants SET latest_version=%s,graph_id=%s,config=%s,context=%s,
                    metadata=%s,name=%s,description=%s,updated_at=now()
                    WHERE assistant_id=%s RETURNING *""",
                    (
                        version, graph_id, Jsonb(config), Jsonb(context), Jsonb(metadata),
                        name, description, assistant_id,
                    ),
                )
                return self._assistant(await cursor.fetchone())

    async def delete(self, assistant_id: UUID, *, delete_threads: bool = False) -> None:
        """Delete application metadata only; checkpointer tables are never queried."""

        async with self.pool.connection() as connection:
            async with connection.transaction():
                cursor = await connection.execute(
                    "SELECT 1 FROM assistants WHERE assistant_id=%s FOR UPDATE", (assistant_id,)
                )
                if await cursor.fetchone() is None:
                    raise AssistantNotFoundError(str(assistant_id))
                if delete_threads:
                    # Runs belonging to matched threads cascade from the normalized FK.
                    await connection.execute(
                        "DELETE FROM threads WHERE metadata @> %s",
                        (Jsonb({"assistant_id": str(assistant_id)}),),
                    )
                    await connection.execute(
                        "DELETE FROM runs WHERE assistant_id=%s", (str(assistant_id),)
                    )
                await connection.execute(
                    "DELETE FROM assistants WHERE assistant_id=%s", (assistant_id,)
                )

    async def search(self, request: AssistantSearchRequest) -> list[dict[str, Any]]:
        fields = [
            "latest_version AS version" if field == "version" else field
            for field in request.select
        ] if request.select else [
            "assistant_id", "graph_id", "config", "context", "created_at",
            "updated_at", "metadata", "latest_version AS version", "name", "description",
        ]
        if any(field not in self._selectable for field in (request.select or [])):
            raise ValueError("invalid assistant projection")
        clauses, params = self._filters(request.metadata, request.graph_id, request.name)
        sort_by = request.sort_by or "created_at"
        if sort_by not in self._sortable:
            raise ValueError("invalid assistant sort")
        order = "DESC" if request.sort_order == "desc" else "ASC"
        query = f"SELECT {','.join(fields)} FROM assistants{clauses} ORDER BY {sort_by} {order} LIMIT %s OFFSET %s"
        params.extend((request.limit, request.offset))
        async with self.pool.connection() as connection:
            cursor = await connection.execute(query, tuple(params))
            rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def count(self, request: AssistantCountRequest) -> int:
        clauses, params = self._filters(request.metadata, request.graph_id, request.name)
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                f"SELECT count(*) AS count FROM assistants{clauses}", tuple(params)
            )
            row = await cursor.fetchone()
        return int(row["count"] if isinstance(row, Mapping) else row[0])

    async def versions(
        self, assistant_id: UUID, request: AssistantVersionsSearchRequest
    ) -> list[Assistant]:
        where = "assistant_id=%s"
        params: list[Any] = [assistant_id]
        if request.metadata:
            where += " AND metadata @> %s"
            params.append(Jsonb(request.metadata))
        params.extend((request.limit, request.offset))
        async with self.pool.connection() as connection:
            cursor = await connection.execute(
                f"""SELECT assistant_id,graph_id,config,context,created_at,updated_at,
                metadata,version,name,description FROM assistant_versions WHERE {where}
                ORDER BY version DESC LIMIT %s OFFSET %s""",
                tuple(params),
            )
            rows = await cursor.fetchall()
        return [Assistant.model_validate(row) for row in rows]

    async def set_latest(self, assistant_id: UUID, version: int) -> Assistant:
        async with self.pool.connection() as connection:
            async with connection.transaction():
                cursor = await connection.execute(
                    """SELECT * FROM assistant_versions
                    WHERE assistant_id=%s AND version=%s FOR SHARE""",
                    (assistant_id, version),
                )
                row = await cursor.fetchone()
                if row is None:
                    exists = await connection.execute(
                        "SELECT 1 FROM assistants WHERE assistant_id=%s", (assistant_id,)
                    )
                    if await exists.fetchone() is None:
                        raise AssistantNotFoundError(str(assistant_id))
                    raise AssistantVersionNotFoundError(str(version))
                cursor = await connection.execute(
                    """UPDATE assistants SET latest_version=%s,graph_id=%s,config=%s,context=%s,
                    metadata=%s,name=%s,description=%s,updated_at=now()
                    WHERE assistant_id=%s RETURNING *""",
                    (
                        version, row["graph_id"], Jsonb(row["config"]), Jsonb(row["context"]),
                        Jsonb(row["metadata"]), row["name"], row["description"], assistant_id,
                    ),
                )
                return self._assistant(await cursor.fetchone())

    @staticmethod
    def _filters(
        metadata: dict[str, Any] | None, graph_id: str | None, name: str | None
    ) -> tuple[str, list[Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if metadata:
            clauses.append("metadata @> %s")
            params.append(Jsonb(metadata))
        if graph_id:
            clauses.append("graph_id=%s")
            params.append(graph_id)
        if name:
            clauses.append("name ILIKE %s")
            params.append(f"%{name}%")
        return (" WHERE " + " AND ".join(clauses) if clauses else ""), params
