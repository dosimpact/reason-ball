from __future__ import annotations

import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from infrastructure.postgres import PostgresRuntime
from infrastructure.postgres.a2a_task_repository import PostgresA2ATaskRepository
from infrastructure.postgres.cron_repository import PostgresCronRepository
from infrastructure.postgres.store_repository import PostgresStoreRepository
from settings import AppSettings

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS") != "1", reason="set RUN_POSTGRES_TESTS=1"
)


@pytest.mark.asyncio
async def test_normalized_extended_repositories_persist_lifecycle_rows() -> None:
    settings = AppSettings.from_env()
    runtime = PostgresRuntime(settings.postgres_conninfo(), settings.env_profile or "local")
    await runtime.open()
    assert runtime.pool is not None
    cron_repository = PostgresCronRepository(runtime.pool)
    store_repository = PostgresStoreRepository(runtime.pool)
    task_repository = PostgresA2ATaskRepository(runtime.pool)

    cron_id, thread_id = uuid4(), uuid4()
    now = datetime.now(UTC).isoformat()
    cron = {
        "cron_id": str(cron_id),
        "assistant_id": "main_graph",
        "thread_id": str(thread_id),
        "schedule": "*/5 * * * *",
        "enabled": True,
        "payload": {"assistant_id": "main_graph", "timezone": "UTC"},
        "next_run_date": None,
        "end_time": None,
        "metadata": {"test_id": str(cron_id)},
        "user_id": None,
        "created_at": now,
        "updated_at": now,
    }
    await cron_repository.create(cron)
    assert (await cron_repository.get(cron_id) or {})["schedule"] == "*/5 * * * *"
    assert await cron_repository.count(metadata={"test_id": str(cron_id)}) == 1
    assert len(await cron_repository.search(metadata={"test_id": str(cron_id)})) == 1
    cron["enabled"] = False
    await cron_repository.update(cron)
    assert (await cron_repository.get(cron_id) or {})["enabled"] is False
    assert await cron_repository.delete(cron_id) is True

    namespace = ["integration", str(uuid4())]
    await store_repository.put(
        namespace=namespace,
        key="profile",
        value={"name": "Ada", "role": "engineer"},
        index=None,
        ttl=10,
    )
    assert (await store_repository.get(namespace=namespace, key="profile") or {})["value"]["name"] == "Ada"
    assert len(
        await store_repository.search(
            namespace_prefix=namespace,
            filter={"role": "engineer"},
            query=None,
            limit=10,
            offset=0,
        )
    ) == 1
    assert namespace in await store_repository.list_namespaces(
        prefix=["integration"], suffix=None, max_depth=None, limit=100, offset=0
    )
    await store_repository.delete(namespace=namespace, key="profile")
    assert await store_repository.get(namespace=namespace, key="profile") is None

    no_ttl_namespace = ["integration", str(uuid4())]
    await store_repository.put(
        namespace=no_ttl_namespace,
        key="bruno-profile",
        value={"name": "Grace"},
        index=None,
        ttl=None,
    )
    no_ttl_item = await store_repository.get(
        namespace=no_ttl_namespace, key="bruno-profile"
    )
    assert no_ttl_item is not None
    assert no_ttl_item["value"] == {"name": "Grace"}
    await store_repository.delete(namespace=no_ttl_namespace, key="bruno-profile")

    task_id = str(uuid4())
    task = {
        "kind": "task",
        "id": task_id,
        "assistantId": "main_graph",
        "contextId": str(uuid4()),
        "status": {"state": "completed"},
    }
    await task_repository.save(task)
    assert (await task_repository.get(task_id) or {})["status"]["state"] == "completed"
    async with runtime.pool.connection() as connection:
        await connection.execute("DELETE FROM a2a_tasks WHERE task_id = %s", (task_id,))
    await runtime.close()
