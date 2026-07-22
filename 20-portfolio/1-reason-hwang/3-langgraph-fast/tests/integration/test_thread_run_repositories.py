import os
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from langgraph.checkpoint.base.id import uuid6

from infrastructure.postgres import PostgresRuntime
from infrastructure.postgres.run_repository import PostgresRunRepository
from infrastructure.postgres.thread_repository import PostgresThreadRepository
from server.runs.runtime import utc_now
from server.runs.runtime import runtime as api_runtime
from server.threads import router as threads_router
from settings import AppSettings

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS") != "1", reason="set RUN_POSTGRES_TESTS=1"
)


@pytest.mark.asyncio
async def test_normalized_rows_are_queryable_and_thread_delete_preserves_checkpoint() -> None:
    settings = AppSettings.from_env()
    postgres = PostgresRuntime(settings.postgres_conninfo(), settings.env_profile or "local")
    await postgres.open()
    threads = PostgresThreadRepository(postgres.pool)
    runs = PostgresRunRepository(postgres.pool)
    thread_id, run_id, checkpoint_id = str(uuid4()), str(uuid4()), str(uuid6())
    now = utc_now()
    thread = {
        "thread_id": thread_id,
        "created_at": now,
        "updated_at": now,
        "state_updated_at": now,
        "metadata": {"integration_id": thread_id},
        "config": {},
        "status": "idle",
        "values": {"step": 1},
        "interrupts": {},
    }
    run = {
        "run_id": run_id,
        "thread_id": thread_id,
        "assistant_id": "main_graph",
        "created_at": now,
        "updated_at": now,
        "status": "success",
        "metadata": {},
        "kwargs": {},
        "multitask_strategy": "enqueue",
    }
    await threads.upsert(thread)
    await runs.upsert(run, {"ok": True})
    config = {"configurable": {"thread_id": thread_id, "checkpoint_ns": ""}}
    checkpoint = {
        "v": 1,
        "ts": now,
        "id": checkpoint_id,
        "channel_values": {},
        "channel_versions": {},
        "versions_seen": {},
        "pending_sends": [],
    }
    await postgres.checkpointer.aput(
        config, checkpoint, {"source": "input", "step": -1, "parents": {}}, {}
    )

    api_runtime.reset()
    api_runtime.set_repositories(threads, runs)
    api_runtime.set_checkpointer(postgres.checkpointer)
    await api_runtime.hydrate()
    assert api_runtime.threads[thread_id]["values"] == {"step": 1}
    hydrated_state = await api_runtime.state_from_storage(thread_id)
    hydrated_history = await api_runtime.history_from_storage(thread_id, limit=10)
    assert hydrated_state["checkpoint"]["checkpoint_id"] == checkpoint_id
    assert hydrated_history[0]["checkpoint"]["checkpoint_id"] == checkpoint_id

    app = FastAPI()
    app.include_router(threads_router)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        updated = await client.post(
            f"/threads/{thread_id}/state",
            json={"values": {"step": 2}, "as_node": "integration"},
        )
        assert updated.status_code == 200
        update_checkpoint_id = updated.json()["checkpoint"]["checkpoint_id"]
        by_path = await client.get(
            f"/threads/{thread_id}/state/{update_checkpoint_id}"
        )
        by_body = await client.post(
            f"/threads/{thread_id}/state/checkpoint",
            json={
                "checkpoint": {
                    "thread_id": thread_id,
                    "checkpoint_ns": "",
                    "checkpoint_id": update_checkpoint_id,
                }
            },
        )
        assert by_path.status_code == 200
        assert by_body.status_code == 200
        assert by_path.json()["checkpoint"]["checkpoint_id"] == update_checkpoint_id
        assert by_body.json()["checkpoint"]["checkpoint_id"] == update_checkpoint_id
        assert by_path.json()["values"] == {"step": 2}
        assert by_body.json()["values"] == {"step": 2}

    filters = {"metadata": {"integration_id": thread_id}}
    assert await threads.count(filters) == 1
    assert str((await threads.search(filters))[0]["thread_id"]) == thread_id
    stored_run = await runs.get(run_id)
    assert stored_run is not None
    assert stored_run["result"] == {"ok": True}
    assert await threads.delete(thread_id) is True
    assert await runs.get(run_id) is None  # application FK cascade only
    restored_latest = await postgres.checkpointer.aget(config)
    restored_original = await postgres.checkpointer.aget(
        {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": "",
                "checkpoint_id": checkpoint_id,
            }
        }
    )
    assert restored_latest is not None
    assert restored_latest["id"] == update_checkpoint_id
    assert restored_original is not None
    assert restored_original["id"] == checkpoint_id
    api_runtime.set_repositories(None, None)
    api_runtime.set_checkpointer(None)
    await postgres.close()
