from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.a2a import router as a2a_router
from server.a2a import set_a2a_task_repository
from server.crons import router as cron_router
from server.crons import set_cron_repository
from server.store import router as store_router
from server.store import set_store_repository


def _client(router: Any) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_repositories():
    set_cron_repository(None)
    set_store_repository(None)
    set_a2a_task_repository(None)
    yield
    set_cron_repository(None)
    set_store_repository(None)
    set_a2a_task_repository(None)


class FakeCronRepository:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}

    async def create(self, cron: dict[str, Any]) -> dict[str, Any]:
        self.rows[cron["cron_id"]] = cron.copy()
        return cron

    async def get(self, cron_id: UUID) -> dict[str, Any] | None:
        row = self.rows.get(str(cron_id))
        return row.copy() if row else None

    async def search(self, **filters: Any) -> list[dict[str, Any]]:
        rows = list(self.rows.values())
        for key in ("assistant_id", "thread_id", "enabled"):
            if filters.get(key) is not None:
                expected = str(filters[key]) if key == "thread_id" else filters[key]
                rows = [row for row in rows if row.get(key) == expected]
        metadata = filters.get("metadata") or {}
        rows = [row for row in rows if all(row["metadata"].get(k) == v for k, v in metadata.items())]
        return rows[filters["offset"] : filters["offset"] + filters["limit"]]

    async def count(self, **filters: Any) -> int:
        return len(
            await self.search(
                **filters, enabled=None, limit=1000, offset=0, sort_by="created_at", sort_order="desc"
            )
        )

    async def update(self, cron: dict[str, Any]) -> dict[str, Any]:
        self.rows[cron["cron_id"]] = cron.copy()
        return cron

    async def delete(self, cron_id: UUID) -> bool:
        return self.rows.pop(str(cron_id), None) is not None


class FakeStoreRepository:
    def __init__(self) -> None:
        self.rows: dict[tuple[tuple[str, ...], str], dict[str, Any]] = {}
        self.last_ttl: float | None = None

    async def put(self, **item: Any) -> None:
        self.last_ttl = item["ttl"]
        now = datetime.now(UTC).isoformat()
        self.rows[(tuple(item["namespace"]), item["key"])] = {
            "namespace": item["namespace"],
            "key": item["key"],
            "value": item["value"],
            "created_at": now,
            "updated_at": now,
        }

    async def delete(self, **identity: Any) -> None:
        self.rows.pop((tuple(identity["namespace"]), identity["key"]), None)

    async def get(self, **identity: Any) -> dict[str, Any] | None:
        return self.rows.get((tuple(identity["namespace"]), identity["key"]))

    async def search(self, **filters: Any) -> list[dict[str, Any]]:
        prefix = tuple(filters["namespace_prefix"] or [])
        rows = [row for (namespace, _), row in self.rows.items() if namespace[: len(prefix)] == prefix]
        return rows[filters["offset"] : filters["offset"] + filters["limit"]]

    async def list_namespaces(self, **filters: Any) -> list[list[str]]:
        prefix = tuple(filters["prefix"] or [])
        return [list(ns) for ns, _ in self.rows if ns[: len(prefix)] == prefix]


class FakeA2ATaskRepository:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}

    async def save(self, task: dict[str, Any]) -> dict[str, Any]:
        self.rows[task["id"]] = task.copy()
        return task

    async def get(self, task_id: str) -> dict[str, Any] | None:
        return self.rows.get(task_id)


def test_cron_repository_survives_new_client_and_supports_lifecycle() -> None:
    repository = FakeCronRepository()
    set_cron_repository(repository)
    created = _client(cron_router).post(
        "/runs/crons",
        json={
            "assistant_id": "main_graph",
            "schedule": "*/5 * * * *",
            "metadata": {"persistent": True},
        },
    ).json()

    restarted = _client(cron_router)
    cron_id = created["cron_id"]
    assert restarted.get(f"/runs/crons/{cron_id}").json()["schedule"] == "*/5 * * * *"
    assert restarted.post("/runs/crons/count", json={"metadata": {"persistent": True}}).json() == 1
    assert len(restarted.post("/runs/crons/search", json={"assistant_id": "main_graph"}).json()) == 1
    assert restarted.patch(f"/runs/crons/{cron_id}", json={"enabled": False}).json()["enabled"] is False
    assert restarted.delete(f"/runs/crons/{cron_id}").status_code == 200
    assert restarted.get(f"/runs/crons/{cron_id}").status_code == 404


def test_store_repository_uses_composite_key_ttl_and_survives_new_client() -> None:
    repository = FakeStoreRepository()
    set_store_repository(repository)
    first = _client(store_router)
    assert first.put(
        "/store/items",
        json={"namespace": ["users", "one"], "key": "profile", "value": {"name": "Ada"}, "ttl": 30},
    ).status_code == 204
    assert repository.last_ttl == 30

    restarted = _client(store_router)
    params = [("key", "profile"), ("namespace", "users"), ("namespace", "one")]
    assert restarted.get("/store/items", params=params).json()["value"] == {"name": "Ada"}
    assert restarted.post("/store/items/search", json={"namespace_prefix": ["users"]}).json()["items"]
    assert ["users", "one"] in restarted.post("/store/namespaces", json={"prefix": ["users"]}).json()
    assert restarted.request(
        "DELETE", "/store/items", json={"namespace": ["users", "one"], "key": "profile"}
    ).status_code == 204
    assert restarted.get("/store/items", params=params).json() is None


def test_a2a_task_get_uses_repository_after_new_client() -> None:
    repository = FakeA2ATaskRepository()
    set_a2a_task_repository(repository)
    assistant_id = uuid4()
    sent = _client(a2a_router).post(
        f"/a2a/{assistant_id}",
        headers={"Accept": "application/json"},
        json={
            "jsonrpc": "2.0",
            "id": "send",
            "method": "message/send",
            "params": {
                "message": {
                    "role": "user",
                    "parts": [{"kind": "text", "text": "persist me"}],
                    "messageId": "message-1",
                    "contextId": "context-1",
                }
            },
        },
    ).json()["result"]

    fetched = _client(a2a_router).post(
        f"/a2a/{assistant_id}",
        headers={"Accept": "application/json"},
        json={
            "jsonrpc": "2.0",
            "id": "get",
            "method": "tasks/get",
            "params": {"id": sent["id"], "contextId": "context-1"},
        },
    )
    assert fetched.json()["result"]["id"] == sent["id"]
