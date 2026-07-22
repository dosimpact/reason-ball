from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.a2a import router as a2a_router
from server.crons import router as crons_router
from server.mcp import router as mcp_router
from server.store import router as store_router
from server.system import router as system_router


def make_client() -> TestClient:
    app = FastAPI(docs_url=None)
    for router in (crons_router, store_router, a2a_router, mcp_router, system_router):
        app.include_router(router)
    return TestClient(app)


def test_cron_lifecycle() -> None:
    client = make_client()
    created = client.post("/runs/crons", json={"assistant_id": "main_graph", "schedule": "*/5 * * * *", "metadata": {"team": "api"}})
    assert created.status_code == 200
    cron = created.json()
    cron_id = cron["cron_id"]
    assert client.get(f"/runs/crons/{cron_id}").json()["schedule"] == "*/5 * * * *"
    assert client.post("/runs/crons/count", json={"assistant_id": "main_graph"}).json() == 1
    assert len(client.post("/runs/crons/search", json={"metadata": {"team": "api"}}).json()) == 1
    patched = client.patch(f"/runs/crons/{cron_id}", json={"enabled": False, "metadata": {"state": "paused"}})
    assert patched.json()["enabled"] is False
    assert patched.json()["metadata"] == {"team": "api", "state": "paused"}
    assert client.delete(f"/runs/crons/{cron_id}").status_code == 200
    assert client.get(f"/runs/crons/{cron_id}").status_code == 404


def test_thread_cron_uses_thread_id() -> None:
    client = make_client()
    thread_id = uuid4()
    response = client.post(f"/threads/{thread_id}/runs/crons", json={"assistant_id": "main_graph", "schedule": "0 0 * * *"})
    assert response.status_code == 200
    assert response.json()["thread_id"] == str(thread_id)


def test_store_lifecycle_search_and_namespaces() -> None:
    client = make_client()
    body = {"namespace": ["users", "one"], "key": "profile", "value": {"name": "Ada", "role": "engineer"}}
    assert client.put("/store/items", json=body).status_code == 204
    item = client.get("/store/items", params=[("key", "profile"), ("namespace", "users"), ("namespace", "one")])
    assert item.json()["value"]["name"] == "Ada"
    found = client.post("/store/items/search", json={"namespace_prefix": ["users"], "filter": {"role": "engineer"}})
    assert [entry["key"] for entry in found.json()["items"]] == ["profile"]
    assert ["users", "one"] in client.post("/store/namespaces", json={"prefix": ["users"]}).json()
    assert client.request("DELETE", "/store/items", json={"namespace": ["users", "one"], "key": "profile"}).status_code == 204
    assert client.get("/store/items", params=[("key", "profile"), ("namespace", "users"), ("namespace", "one")]).json() is None


def test_mcp_protocol_and_http_method_contract(monkeypatch) -> None:
    client = make_client()
    headers = {"Accept": "application/json, text/event-stream"}
    initialized = client.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05"}})
    assert initialized.json()["result"]["serverInfo"]["name"] == "reason-langgraph-fast"
    tools = client.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    assert {tool["name"] for tool in tools.json()["result"]["tools"]} == {"main_graph", "tenk_subgraph", "starter_graph"}
    assert client.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "method": "notifications/initialized"}).status_code == 202
    assert client.post("/mcp/", headers=headers, json={"jsonrpc": "2.0", "id": 3, "result": {}}).status_code == 202
    assert client.get("/mcp/").status_code == 405
    assert client.delete("/mcp/").status_code == 404


def test_a2a_send_and_get_task() -> None:
    client = make_client()
    assistant_id = uuid4()
    sent = client.post(f"/a2a/{assistant_id}", headers={"Accept": "application/json"}, json={"jsonrpc": "2.0", "id": "1", "method": "message/send", "params": {"message": {"role": "user", "parts": [{"kind": "text", "text": "hello"}], "messageId": "m1"}}})
    task = sent.json()["result"]
    assert task["status"]["state"] == "completed"
    fetched = client.post(f"/a2a/{assistant_id}", headers={"Accept": "application/json"}, json={"jsonrpc": "2.0", "id": "2", "method": "tasks/get", "params": {"id": task["id"], "contextId": task["contextId"]}})
    assert fetched.json()["result"]["id"] == task["id"]


def test_system_endpoints() -> None:
    client = make_client()
    assert client.get("/ok").json() == {"ok": True}
    assert client.get("/info").json()["flags"]["mcp"] is True
    assert client.get("/metrics?format=json").json()["workers"]["available"] == 10
    assert "langgraph_up 1" in client.get("/metrics").text
    assert client.get("/docs").status_code == 200
