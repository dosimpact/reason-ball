from uuid import uuid4

import pytest
from psycopg.types.json import Jsonb

from infrastructure.postgres.assistant_repository import PostgresAssistantRepository
from infrastructure.postgres.migrations import prepare_schema
from server.assistants.models import (
    AssistantCountRequest,
    AssistantCreate,
    AssistantPatch,
    AssistantSearchRequest,
    AssistantVersionsSearchRequest,
)
from server.assistants.repository import AssistantNotFoundError
from tests.integration.normalized_postgres import SingleConnectionPool, isolated_connection


@pytest.mark.asyncio
async def test_postgres_assistant_lifecycle_versions_search_and_checkpoint_safe_delete() -> None:
    async with isolated_connection() as connection:
        await prepare_schema(connection, profile="local")
        repository = PostgresAssistantRepository(SingleConnectionPool(connection))
        assistant_id, thread_id, run_id = uuid4(), uuid4(), uuid4()
        created = await repository.create(AssistantCreate(
            assistant_id=assistant_id, graph_id="main_graph", name="Persistent Assistant",
            metadata={"team": "reason", "color": "blue"},
        ))
        assert created.version == 1
        patched = await repository.patch(
            assistant_id, AssistantPatch(metadata={"color": "red"}, name="Persistent v2")
        )
        assert patched.version == 2
        assert patched.metadata == {"team": "reason", "color": "red"}
        assert await repository.count(AssistantCountRequest(metadata={"team": "reason"})) == 1
        results = await repository.search(AssistantSearchRequest(name="persistent", select=["assistant_id", "version"]))
        assert results == [{"assistant_id": assistant_id, "version": 2}]
        versions = await repository.versions(assistant_id, AssistantVersionsSearchRequest())
        assert [item.version for item in versions] == [2, 1]
        assert (await repository.set_latest(assistant_id, 1)).version == 1

        now = created.created_at
        await connection.execute(
            """INSERT INTO threads
            (thread_id,created_at,updated_at,state_updated_at,metadata,config,values,interrupts,status)
            VALUES (%s,%s,%s,%s,%s,'{}','{}','{}','idle')""",
            (thread_id, now, now, now, Jsonb({"assistant_id": str(assistant_id)})),
        )
        await connection.execute(
            """INSERT INTO runs
            (run_id,thread_id,assistant_id,created_at,updated_at,status,metadata,kwargs)
            VALUES (%s,%s,%s,%s,%s,'success','{}','{}')""",
            (run_id, thread_id, str(assistant_id), now, now),
        )
        # Sentinel tables prove the repository has no checkpoint delete dependency.
        await connection.execute("CREATE TABLE checkpoints (thread_id text PRIMARY KEY)")
        await connection.execute("INSERT INTO checkpoints VALUES (%s)", (str(thread_id),))
        await repository.delete(assistant_id, delete_threads=True)
        with pytest.raises(AssistantNotFoundError):
            await repository.get(assistant_id)
        thread_count = await (await connection.execute("SELECT count(*) AS n FROM threads")).fetchone()
        run_count = await (await connection.execute("SELECT count(*) AS n FROM runs")).fetchone()
        checkpoint_count = await (await connection.execute("SELECT count(*) AS n FROM checkpoints")).fetchone()
        assert thread_count is not None and thread_count["n"] == 0
        assert run_count is not None and run_count["n"] == 0
        assert checkpoint_count is not None and checkpoint_count["n"] == 1
