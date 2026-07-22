from fastapi import FastAPI
from fastapi.testclient import TestClient
from types import SimpleNamespace

import pytest

from server.runs import router as runs_router
from server.runs import runtime
from server.streaming import router as streaming_router
from server.threads import router as threads_router


def make_client() -> TestClient:
    runtime.reset()
    app = FastAPI()
    app.include_router(threads_router)
    app.include_router(runs_router)
    app.include_router(streaming_router)
    return TestClient(app)


def test_thread_crud_search_count_copy_and_prune() -> None:
    client = make_client()
    created = client.post("/threads", json={"metadata": {"tenant": "a"}})
    assert created.status_code == 200
    thread = created.json()
    thread_id = thread["thread_id"]

    assert client.post("/threads", json={"thread_id": thread_id}).status_code == 409
    assert client.post(
        "/threads", json={"thread_id": thread_id, "if_exists": "do_nothing"}
    ).status_code == 200
    assert client.get(f"/threads/{thread_id}").json()["metadata"] == {"tenant": "a"}
    assert client.patch(f"/threads/{thread_id}", json={"metadata": {"stage": "dev"}}).json()[
        "metadata"
    ] == {"tenant": "a", "stage": "dev"}
    assert len(client.post("/threads/search", json={"metadata": {"tenant": "a"}}).json()) == 1
    assert client.post("/threads/count", json={"status": "idle"}).json() == 1

    copied = client.post(f"/threads/{thread_id}/copy").json()
    assert copied["thread_id"] != thread_id
    assert client.post(
        "/threads/prune", json={"thread_ids": [copied["thread_id"]], "strategy": "delete"}
    ).json() == {"pruned_count": 1}
    assert client.delete(f"/threads/{thread_id}").status_code == 200
    assert client.get(f"/threads/{thread_id}").status_code == 404


def test_thread_state_checkpoint_and_history() -> None:
    client = make_client()
    thread_id = client.post("/threads", json={}).json()["thread_id"]
    first = client.post(f"/threads/{thread_id}/state", json={"values": {"step": 1}}).json()
    second = client.post(f"/threads/{thread_id}/state", json={"values": {"done": True}}).json()

    latest = client.get(f"/threads/{thread_id}/state").json()
    assert latest["values"] == {"step": 1, "done": True}
    checkpoint_id = first["checkpoint"]["checkpoint_id"]
    assert client.get(f"/threads/{thread_id}/state/{checkpoint_id}").json()["values"] == {"step": 1}
    assert client.post(
        f"/threads/{thread_id}/state/checkpoint",
        json={"checkpoint": {"checkpoint_id": checkpoint_id}},
    ).json()["values"] == {"step": 1}
    assert len(client.get(f"/threads/{thread_id}/history?limit=10").json()) == 2
    assert len(client.post(f"/threads/{thread_id}/history", json={"limit": 1}).json()) == 1
    assert second["checkpoint"]["checkpoint_id"] == latest["checkpoint"]["checkpoint_id"]


def test_stateful_runs_wait_list_join_stream_and_cancel() -> None:
    client = make_client()
    thread_id = client.post("/threads", json={}).json()["thread_id"]
    payload = {"assistant_id": "main_graph", "input": {"message": "hello"}}

    waited = client.post(f"/threads/{thread_id}/runs/wait", json=payload)
    assert waited.json() == {"message": "hello"}
    runs = client.get(f"/threads/{thread_id}/runs").json()
    assert runs[0]["status"] == "success"
    run_id = runs[0]["run_id"]
    assert client.get(f"/threads/{thread_id}/runs/{run_id}").json()["run_id"] == run_id
    assert client.get(f"/threads/{thread_id}/runs/{run_id}/join").json() == {"message": "hello"}
    resumed = client.get(f"/threads/{thread_id}/runs/{run_id}/stream")
    assert resumed.headers["content-type"].startswith("text/event-stream")
    assert "event: values" in resumed.text

    held = client.post(
        f"/threads/{thread_id}/runs",
        json={"assistant_id": "main_graph", "input": {}, "_hold": True},
    ).json()
    conflict = client.post(
        f"/threads/{thread_id}/runs",
        json={"assistant_id": "main_graph", "multitask_strategy": "reject"},
    )
    assert conflict.status_code == 409
    cancelled = client.post(f"/threads/{thread_id}/runs/{held['run_id']}/cancel").json()
    assert cancelled["status"] == "interrupted"
    assert client.delete(f"/threads/{thread_id}/runs/{run_id}").status_code == 200


def test_stateless_and_batch_runs() -> None:
    client = make_client()
    payload = {"assistant_id": "main_graph", "input": {"x": 1}}
    assert client.post("/runs", json=payload).json() == {"x": 1}
    assert client.post("/runs/wait", json=payload).json() == {"x": 1}
    assert client.post("/runs/batch", json=[payload, payload]).json() == [{"x": 1}, {"x": 1}]
    stream = client.post("/runs/stream", json=payload)
    assert stream.headers["content-type"].startswith("text/event-stream")
    assert "event: values" in stream.text
    assert client.post("/runs", json={}).status_code == 422


def test_capacity_is_ten_active_ten_queued_then_429() -> None:
    client = make_client()
    threads = [client.post("/threads", json={}).json()["thread_id"] for _ in range(21)]
    payload = {"assistant_id": "main_graph", "_hold": True}
    statuses = [client.post(f"/threads/{thread_id}/runs", json=payload).status_code for thread_id in threads]
    assert statuses[:20] == [200] * 20
    assert statuses[20] == 429
    assert len(runtime.active) == 10
    assert len(runtime.queued) == 10


def test_thread_and_protocol_sse() -> None:
    client = make_client()
    thread_id = client.post("/threads", json={}).json()["thread_id"]
    client.post(f"/threads/{thread_id}/state", json={"values": {"n": 1}})

    joined = client.get(f"/threads/{thread_id}/stream")
    assert "event: values" in joined.text
    protocol = client.post(
        f"/threads/{thread_id}/stream/events", json={"channels": ["values"], "since": 0}
    )
    assert protocol.status_code == 200
    assert '"type": "event"' in protocol.text
    assert client.post(f"/threads/{thread_id}/stream/events", json={}).status_code == 400

    tree = client.post(
        f"/threads/{thread_id}/commands", json={"id": 7, "method": "agent.getTree"}
    ).json()
    assert tree["type"] == "response"
    assert tree["id"] == 7
    assert client.post(
        f"/threads/{thread_id}/commands", json={"id": 8, "method": "unknown"}
    ).status_code == 400


def test_bulk_cancel_returns_204() -> None:
    client = make_client()
    thread_id = client.post("/threads", json={}).json()["thread_id"]
    held = client.post(
        f"/threads/{thread_id}/runs", json={"assistant_id": "main_graph", "_hold": True}
    ).json()
    assert client.post("/runs/cancel", json={"thread_id": thread_id, "run_ids": [held["run_id"]]}).status_code == 204
    assert runtime.runs[held["run_id"]]["status"] == "interrupted"


class MemoryThreadRepository:
    def __init__(self) -> None:
        self.rows = {}
        self.search_calls = 0
        self.count_calls = 0

    async def get(self, thread_id):
        return self.rows.get(thread_id)

    async def list_all(self):
        return list(self.rows.values())

    async def upsert(self, thread):
        self.rows[thread["thread_id"]] = dict(thread)
        return self.rows[thread["thread_id"]]

    async def search(self, filters):
        self.search_calls += 1
        return list(self.rows.values())

    async def count(self, filters):
        self.count_calls += 1
        return len(self.rows)

    async def delete(self, thread_id):
        return self.rows.pop(thread_id, None) is not None


class MemoryRunRepository:
    def __init__(self) -> None:
        self.rows = {}

    async def get(self, run_id):
        return self.rows.get(run_id)

    async def list_all(self):
        return list(self.rows.values())

    async def list_for_thread(self, thread_id, **kwargs):
        return [row for row in self.rows.values() if row["thread_id"] == thread_id]

    async def upsert(self, run, result=None):
        self.rows[run["run_id"]] = {**run, "result": result}
        return self.rows[run["run_id"]]

    async def delete(self, run_id):
        return self.rows.pop(run_id, None) is not None

    async def delete_for_thread(self, thread_id):
        for run_id in [key for key, value in self.rows.items() if value["thread_id"] == thread_id]:
            self.rows.pop(run_id)


def test_normalized_repositories_are_metadata_source_of_truth() -> None:
    client = make_client()
    threads = MemoryThreadRepository()
    runs = MemoryRunRepository()
    runtime.set_repositories(threads, runs)

    created = client.post("/threads", json={"metadata": {"stored": True}}).json()
    thread_id = created["thread_id"]
    runtime.threads.clear()  # process snapshot is deliberately stale
    assert client.post("/threads/search", json={}).json()[0]["thread_id"] == thread_id
    assert client.post("/threads/count", json={}).json() == 1
    assert threads.search_calls == 1
    assert threads.count_calls == 1

    response = client.post(
        f"/threads/{thread_id}/runs/wait",
        json={"assistant_id": "main_graph", "input": {"persisted": True}},
    )
    assert response.status_code == 200
    assert len(runs.rows) == 1
    assert next(iter(runs.rows.values()))["status"] == "success"


class MemoryCheckpointer:
    def __init__(self, thread_id: str) -> None:
        self.item = SimpleNamespace(
            config={
                "configurable": {
                    "thread_id": thread_id,
                    "checkpoint_ns": "",
                    "checkpoint_id": "checkpoint-1",
                }
            },
            checkpoint={
                "id": "checkpoint-1",
                "ts": "2026-07-12T00:00:00Z",
                "channel_values": {"survived": True},
            },
            metadata={"source": "loop"},
            parent_config=None,
        )

    async def aget_tuple(self, config):
        return self.item

    async def alist(self, config, **kwargs):
        yield self.item


@pytest.mark.asyncio
async def test_hydration_restores_current_metadata_and_reads_checkpoint_history() -> None:
    runtime.reset()
    threads = MemoryThreadRepository()
    runs = MemoryRunRepository()
    thread = runtime.create_thread({"metadata": {"restart": True}})
    thread["values"] = {"current": "normalized"}
    await threads.upsert(thread)
    runtime.reset()
    runtime.set_repositories(threads, runs)
    runtime.set_checkpointer(MemoryCheckpointer(thread["thread_id"]))

    await runtime.hydrate()
    assert runtime.threads[thread["thread_id"]]["values"] == {"current": "normalized"}
    state = await runtime.state_from_storage(thread["thread_id"])
    history = await runtime.history_from_storage(thread["thread_id"], limit=10)
    assert state["checkpoint"]["checkpoint_id"] == "checkpoint-1"
    assert history[0]["values"] == {"survived": True}
