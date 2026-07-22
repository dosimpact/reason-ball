"""Additive, idempotent schema for normalized application metadata.

LangGraph checkpointer tables intentionally do not appear in this module.  They
are owned by ``AsyncPostgresSaver`` and must never be FK/cascade targets of the
application metadata schema.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

SCHEMA_VERSION = 1

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
)


async def prepare_schema(connection: Any, *, profile: str) -> None:
    """Create schema locally or verify it without DDL for non-local profiles."""

    if profile == "local":
        for statement in DDL:
            await connection.execute(statement)
        return
    cursor = await connection.execute(
        "SELECT version FROM schema_migrations WHERE version = 1 AND name = 'normalized_metadata_core'"
    )
    row = await cursor.fetchone()  # type: ignore[attr-defined]
    version = row.get("version") if isinstance(row, Mapping) else row[0] if row else None
    if version is None or int(version) != SCHEMA_VERSION:
        raise RuntimeError("PostgreSQL schema is missing or outdated; migrations are local-only")
