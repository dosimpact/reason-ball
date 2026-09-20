"""Additive, idempotent schema for normalized application metadata.

LangGraph checkpointer tables intentionally do not appear in this module.  They
are owned by ``AsyncPostgresSaver`` and must never be FK/cascade targets of the
application metadata schema.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

SCHEMA_VERSION = 2
SCHEMA_LOCK_NAME = "langgraph_fast_schema_migration"

OWNED_TABLES = (
    "schema_migrations",
    "assistants",
    "assistant_versions",
    "threads",
    "runs",
    "crons",
    "store_items",
    "a2a_tasks",
    "checkpoint_migrations",
    "checkpoints",
    "checkpoint_blobs",
    "checkpoint_writes",
)

CHECKPOINTER_TABLES = (
    "checkpoint_migrations",
    "checkpoints",
    "checkpoint_blobs",
    "checkpoint_writes",
)

DDL = (
    """CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    name text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
)""",
    """CREATE TABLE IF NOT EXISTS assistants (
    assistant_id uuid PRIMARY KEY,
    latest_version integer NOT NULL CHECK (latest_version > 0),
    graph_id text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    name text NOT NULL DEFAULT 'Untitled',
    description text,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
)""",
    """CREATE TABLE IF NOT EXISTS assistant_versions (
    assistant_id uuid NOT NULL REFERENCES assistants(assistant_id) ON DELETE CASCADE,
    version integer NOT NULL CHECK (version > 0),
    graph_id text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    name text NOT NULL DEFAULT 'Untitled',
    description text,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (assistant_id, version)
)""",
    """CREATE TABLE IF NOT EXISTS threads (
    thread_id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    state_updated_at timestamptz NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    values jsonb NOT NULL DEFAULT '{}'::jsonb,
    interrupts jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL,
    ttl jsonb
)""",
    """CREATE TABLE IF NOT EXISTS runs (
    run_id uuid PRIMARY KEY,
    thread_id uuid REFERENCES threads(thread_id) ON DELETE CASCADE,
    assistant_id text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    status text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    kwargs jsonb NOT NULL DEFAULT '{}'::jsonb,
    multitask_strategy text,
    result jsonb
)""",
    """CREATE TABLE IF NOT EXISTS crons (
    cron_id uuid PRIMARY KEY,
    assistant_id text NOT NULL,
    thread_id uuid,
    schedule text NOT NULL,
    timezone text,
    enabled boolean NOT NULL DEFAULT true,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    next_run_date timestamptz,
    end_time timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    user_id text
)""",
    """CREATE TABLE IF NOT EXISTS store_items (
    namespace text[] NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    index_config jsonb,
    ttl_minutes double precision,
    expires_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (namespace, key)
)""",
    """CREATE TABLE IF NOT EXISTS a2a_tasks (
    task_id text PRIMARY KEY,
    assistant_id text NOT NULL,
    context_id text NOT NULL,
    status text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
)""",
    "CREATE INDEX IF NOT EXISTS assistants_graph_id_idx ON assistants(graph_id)",
    "CREATE INDEX IF NOT EXISTS assistants_name_lower_idx ON assistants(lower(name))",
    "CREATE INDEX IF NOT EXISTS assistants_metadata_gin_idx ON assistants USING gin(metadata)",
    "CREATE INDEX IF NOT EXISTS threads_status_idx ON threads(status)",
    "CREATE INDEX IF NOT EXISTS threads_updated_at_idx ON threads(updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS threads_metadata_gin_idx ON threads USING gin(metadata)",
    "CREATE INDEX IF NOT EXISTS runs_thread_id_idx ON runs(thread_id)",
    "CREATE INDEX IF NOT EXISTS runs_assistant_id_idx ON runs(assistant_id)",
    "CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status)",
    "CREATE INDEX IF NOT EXISTS crons_assistant_id_idx ON crons(assistant_id)",
    "CREATE INDEX IF NOT EXISTS crons_thread_id_idx ON crons(thread_id)",
    "CREATE INDEX IF NOT EXISTS crons_next_run_date_idx ON crons(next_run_date) WHERE enabled",
    "CREATE INDEX IF NOT EXISTS store_items_namespace_gin_idx ON store_items USING gin(namespace)",
    "CREATE INDEX IF NOT EXISTS store_items_expires_at_idx ON store_items(expires_at)",
    "CREATE INDEX IF NOT EXISTS a2a_tasks_assistant_id_idx ON a2a_tasks(assistant_id)",
    """INSERT INTO schema_migrations(version, name, checksum)
    VALUES (1, 'normalized_metadata_core', 'normalized-metadata-v1')
    ON CONFLICT (version) DO NOTHING""",
    """INSERT INTO schema_migrations(version, name, checksum)
    VALUES (2, 'langgraph_schema_namespace', 'langgraph-schema-v2')
    ON CONFLICT (version) DO NOTHING""",
)


def _quoted_identifier(value: str) -> str:
    if re.fullmatch(r"[a-z_][a-z0-9_]*", value) is None:
        raise ValueError("PostgreSQL schema must be a lowercase identifier")
    return f'"{value}"'


async def _move_public_tables(connection: Any, schema: str) -> None:
    quoted_schema = _quoted_identifier(schema)
    await connection.execute(
        "SELECT pg_advisory_lock(hashtext(%s))", (SCHEMA_LOCK_NAME,)
    )
    try:
        for table in OWNED_TABLES:
            cursor = await connection.execute(
                "SELECT to_regclass(%s) AS source, to_regclass(%s) AS target",
                (f"public.{table}", f"{schema}.{table}"),
            )
            row = await cursor.fetchone()
            source = row.get("source") if isinstance(row, Mapping) else row[0]
            target = row.get("target") if isinstance(row, Mapping) else row[1]
            if source is not None and target is not None:
                raise RuntimeError(
                    f"PostgreSQL schema migration conflict for table {table}"
                )
            if source is not None:
                await connection.execute(
                    f'ALTER TABLE public."{table}" SET SCHEMA {quoted_schema}'
                )
    finally:
        await connection.execute(
            "SELECT pg_advisory_unlock(hashtext(%s))", (SCHEMA_LOCK_NAME,)
        )


async def prepare_schema(
    connection: Any,
    *,
    profile: str,
    schema: str | None = None,
) -> None:
    """Create schema locally or verify it without DDL for non-local profiles."""

    quoted_schema = _quoted_identifier(schema) if schema is not None else None
    if profile == "local":
        if schema is not None:
            await connection.execute(f"CREATE SCHEMA IF NOT EXISTS {quoted_schema}")
            await _move_public_tables(connection, schema)
            await connection.execute(f"SET search_path TO {quoted_schema}, public")
        for statement in DDL:
            await connection.execute(statement)
        return
    if schema is not None:
        cursor = await connection.execute("SELECT to_regnamespace(%s)", (schema,))
        row = await cursor.fetchone()
        namespace = (
            next(iter(row.values()), None)
            if isinstance(row, Mapping)
            else row[0] if row else None
        )
        if namespace is None:
            raise RuntimeError(
                "PostgreSQL schema is missing or outdated; migrations are local-only"
            )
        await connection.execute(f"SET search_path TO {quoted_schema}, public")
    cursor = await connection.execute(
        "SELECT version FROM schema_migrations "
        "WHERE version = 2 AND name = 'langgraph_schema_namespace'"
    )
    row = await cursor.fetchone()  # type: ignore[attr-defined]
    version = row.get("version") if isinstance(row, Mapping) else row[0] if row else None
    if version is None or int(version) != SCHEMA_VERSION:
        raise RuntimeError("PostgreSQL schema is missing or outdated; migrations are local-only")
    if schema is not None:
        for table in CHECKPOINTER_TABLES:
            cursor = await connection.execute(
                "SELECT to_regclass(%s)", (f"{schema}.{table}",)
            )
            row = await cursor.fetchone()
            relation = (
                next(iter(row.values()), None)
                if isinstance(row, Mapping)
                else row[0] if row else None
            )
            if relation is None:
                raise RuntimeError(
                    "PostgreSQL schema is missing or outdated; migrations are local-only"
                )
