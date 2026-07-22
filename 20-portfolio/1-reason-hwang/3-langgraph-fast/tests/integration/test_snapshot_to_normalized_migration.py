from datetime import UTC, datetime
from uuid import uuid4

import pytest
from psycopg.types.json import Jsonb

from infrastructure.postgres.migrations import prepare_schema
from infrastructure.postgres.snapshot_migration import (
    drop_legacy_tables,
    run_snapshot_backfill,
)
from tests.integration.normalized_postgres import isolated_connection


@pytest.mark.asyncio
async def test_snapshot_backfill_is_verified_idempotent_and_legacy_drop_is_gated() -> None:
    async with isolated_connection() as connection:
        await prepare_schema(connection, profile="local")
        await connection.execute(
            """CREATE TABLE langgraph_fast_resources (
            kind text NOT NULL, resource_id text NOT NULL, payload jsonb NOT NULL,
            PRIMARY KEY(kind,resource_id))"""
        )
        await connection.execute(
            "CREATE TABLE langgraph_fast_schema_version (version integer PRIMARY KEY)"
        )
        await connection.execute("INSERT INTO langgraph_fast_schema_version VALUES (1)")
        assistant_id, thread_id, run_id, orphan_run_id = uuid4(), uuid4(), uuid4(), uuid4()
        now = datetime.now(UTC).isoformat()
        version = {
            "assistant_id": str(assistant_id), "graph_id": "main_graph",
            "config": {}, "context": {}, "metadata": {"migrated": True},
            "name": "Migrated", "description": None, "version": 1,
            "created_at": now, "updated_at": now,
        }
        snapshot = {
            "assistants": {"versions": {str(assistant_id): [version]}, "latest": {str(assistant_id): 1}},
            "runtime": {
                "threads": {str(thread_id): {
                    "thread_id": str(thread_id), "created_at": now, "updated_at": now,
                    "state_updated_at": now, "metadata": {"assistant_id": str(assistant_id)},
                    "config": {}, "values": {}, "interrupts": {}, "status": "idle",
                }},
                "runs": {str(run_id): {
                    "run_id": str(run_id), "thread_id": str(thread_id),
                    "assistant_id": str(assistant_id), "created_at": now,
                    "updated_at": now, "status": "success", "metadata": {},
                    "kwargs": {}, "multitask_strategy": "enqueue",
                }, str(orphan_run_id): {
                    "run_id": str(orphan_run_id), "thread_id": str(uuid4()),
                    "assistant_id": str(assistant_id), "created_at": now,
                    "updated_at": now, "status": "success", "metadata": {},
                    "kwargs": {}, "multitask_strategy": "enqueue",
                }},
                "run_results": {
                    str(run_id): {"ok": True}, str(orphan_run_id): {"orphan": True}
                },
            },
            "crons": {}, "store": [], "a2a": {},
        }
        await connection.execute(
            "INSERT INTO langgraph_fast_resources VALUES ('runtime','snapshot',%s)",
            (Jsonb(snapshot),),
        )

        report = await run_snapshot_backfill(connection)
        assert report is not None and report.valid
        assert report.source_counts["assistants"] == 1
        assert report.source_counts["assistant_versions"] == 1
        assert report.source_counts["threads"] == 1
        assert report.source_counts["runs"] == 2
        cursor = await connection.execute(
            "SELECT thread_id FROM runs WHERE run_id=%s", (orphan_run_id,)
        )
        orphan_row = await cursor.fetchone()
        assert orphan_row is not None and orphan_row["thread_id"] is None
        assert await run_snapshot_backfill(connection) is None

        await drop_legacy_tables(connection)
        cursor = await connection.execute(
            "SELECT to_regclass('langgraph_fast_resources') AS table_name"
        )
        table_row = await cursor.fetchone()
        assert table_row is not None and table_row["table_name"] is None
        assert await run_snapshot_backfill(connection) is None
        await prepare_schema(connection, profile="production")
