import os
from uuid import uuid4

import pytest

from infrastructure.postgres import PostgresRuntime
from server.assistants.models import AssistantCreate
from server.assistants.repository import InMemoryAssistantRepository
from settings import AppSettings

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS") != "1", reason="set RUN_POSTGRES_TESTS=1"
)


@pytest.mark.asyncio
async def test_local_setup_is_idempotent_and_assistant_delete_preserves_checkpoint() -> None:
    settings = AppSettings.from_env()
    runtime = PostgresRuntime(settings.postgres_conninfo(), settings.env_profile or "local")
    await runtime.open()
    await runtime.close()

    runtime = PostgresRuntime(settings.postgres_conninfo(), settings.env_profile or "local")
    await runtime.open()
    thread_id = str(uuid4())
    checkpoint_id = str(uuid4())
    config = {"configurable": {"thread_id": thread_id, "checkpoint_ns": ""}}
    checkpoint = {
        "v": 1,
        "ts": "2026-07-11T00:00:00+00:00",
        "id": checkpoint_id,
        "channel_values": {},
        "channel_versions": {},
        "versions_seen": {},
        "pending_sends": [],
    }
    await runtime.checkpointer.aput(
        config,
        checkpoint,
        {"source": "input", "step": -1, "parents": {}},
        {},
    )

    repository = InMemoryAssistantRepository()
    assistant = repository.create(AssistantCreate(graph_id="main_graph"))
    repository.delete(assistant.assistant_id)

    restored = await runtime.checkpointer.aget(config)
    assert restored is not None
    assert restored["id"] == checkpoint_id
    await runtime.close()
