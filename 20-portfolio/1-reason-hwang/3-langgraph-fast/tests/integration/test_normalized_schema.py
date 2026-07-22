import pytest

from infrastructure.postgres.migrations import DDL, prepare_schema
from tests.integration.normalized_postgres import isolated_connection


@pytest.mark.asyncio
async def test_normalized_schema_has_expected_tables_pk_fk_and_indexes() -> None:
    async with isolated_connection() as connection:
        await prepare_schema(connection, profile="local")
        cursor = await connection.execute(
            """SELECT table_name FROM information_schema.tables
            WHERE table_schema=current_schema()"""
        )
        tables = {row["table_name"] for row in await cursor.fetchall()}
        assert {
            "schema_migrations", "assistants", "assistant_versions", "threads",
            "runs", "crons", "store_items", "a2a_tasks",
        } <= tables
        assert not any("checkpoints" in statement for statement in DDL)
        cursor = await connection.execute(
            """SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
            WHERE conrelid='runs'::regclass"""
        )
        definitions = [row["definition"] for row in await cursor.fetchall()]
        assert any("FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE CASCADE" in value for value in definitions)
        cursor = await connection.execute(
            "SELECT indexname FROM pg_indexes WHERE schemaname=current_schema()"
        )
        indexes = {row["indexname"] for row in await cursor.fetchall()}
        assert "assistants_metadata_gin_idx" in indexes
        assert "store_items_namespace_gin_idx" in indexes


@pytest.mark.asyncio
async def test_non_local_verification_does_not_reference_legacy_tables() -> None:
    async with isolated_connection() as connection:
        await prepare_schema(connection, profile="local")
        await prepare_schema(connection, profile="production")
