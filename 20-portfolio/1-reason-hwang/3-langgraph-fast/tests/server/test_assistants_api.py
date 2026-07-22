from uuid import uuid4

import pytest
from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.assistants.repository import InMemoryAssistantRepository
from server.assistants.router import router, set_assistant_repository


@pytest.fixture
def client() -> TestClient:
    set_assistant_repository(InMemoryAssistantRepository())
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def create_assistant(client: TestClient, **overrides) -> dict:
    payload = {
        "graph_id": "main_graph",
        "name": "Research Assistant",
        "metadata": {"team": "reason"},
        **overrides,
    }
    response = client.post("/assistants", json=payload)
    assert response.status_code == 200
    return response.json()


def test_create_get_duplicate_and_unknown_graph(client: TestClient) -> None:
    assistant_id = str(uuid4())
    created = create_assistant(client, assistant_id=assistant_id)

    assert created["assistant_id"] == assistant_id
    assert created["version"] == 1
    assert created["config"] == {}
    assert client.get(f"/assistants/{assistant_id}").json() == created

    conflict = client.post(
        "/assistants",
        json={"assistant_id": assistant_id, "graph_id": "main_graph"},
    )
    assert conflict.status_code == 409

    unchanged = client.post(
        "/assistants",
        json={
            "assistant_id": assistant_id,
            "graph_id": "main_graph",
            "if_exists": "do_nothing",
        },
    )
    assert unchanged.status_code == 200
    assert unchanged.json()["name"] == "Research Assistant"
    assert client.post("/assistants", json={"graph_id": "missing"}).status_code == 404


def test_search_count_sort_paging_and_select(client: TestClient) -> None:
    create_assistant(client, name="Alpha", metadata={"team": "a"})
    create_assistant(
        client,
        graph_id="starter_graph",
        name="Beta Alpha",
        metadata={"team": "a"},
    )
    create_assistant(client, name="Gamma", metadata={"team": "b"})

    response = client.post(
        "/assistants/search",
        json={
            "metadata": {"team": "a"},
            "name": "ALPHA",
            "sort_by": "name",
            "sort_order": "desc",
            "limit": 1,
            "select": ["assistant_id", "name"],
        },
    )
    assert response.status_code == 200
    assert set(response.json()[0]) == {"assistant_id", "name"}
    assert response.json()[0]["name"] == "Beta Alpha"

    count = client.post("/assistants/count", json={"metadata": {"team": "a"}})
    assert count.status_code == 200
    assert count.json() == 2
    assert client.post("/assistants/search", json={"limit": 0}).status_code == 422


def test_patch_creates_version_and_latest_moves_pointer(client: TestClient) -> None:
    created = create_assistant(client, metadata={"stable": True, "color": "blue"})
    assistant_id = created["assistant_id"]

    patched = client.patch(
        f"/assistants/{assistant_id}",
        json={"name": "Version Two", "metadata": {"color": "red"}},
    )
    assert patched.status_code == 200
    assert patched.json()["version"] == 2
    assert patched.json()["metadata"] == {"stable": True, "color": "red"}

    versions = client.post(f"/assistants/{assistant_id}/versions")
    assert versions.status_code == 200
    assert [item["version"] for item in versions.json()] == [2, 1]

    latest = client.post(f"/assistants/{assistant_id}/latest?version=1")
    assert latest.status_code == 200
    assert latest.json()["version"] == 1
    assert latest.json()["name"] == "Research Assistant"
    assert client.post(f"/assistants/{assistant_id}/latest?version=99").status_code == 404
    assert client.patch(f"/assistants/{assistant_id}", json={"name": None}).status_code == 422


def test_graph_subgraphs_and_schemas(client: TestClient) -> None:
    created = create_assistant(client)
    assistant_id = created["assistant_id"]

    graph = client.get(f"/assistants/{assistant_id}/graph?xray=true")
    assert graph.status_code == 200
    assert {node["id"] for node in graph.json()["nodes"]} == {
        "main_graph",
        "tenk_subgraph",
        "starter_graph",
    }
    assert client.get("/assistants/main_graph/graph").status_code == 200

    subgraphs = client.get(f"/assistants/{assistant_id}/subgraphs")
    assert subgraphs.status_code == 200
    assert set(subgraphs.json()) == {"tenk_subgraph", "starter_graph"}

    namespace = client.get(
        f"/assistants/{assistant_id}/subgraphs/tenk_subgraph?recurse=true"
    )
    assert namespace.status_code == 200
    assert set(namespace.json()) == {"tenk_subgraph"}

    schemas = client.get(f"/assistants/{assistant_id}/schemas")
    assert schemas.status_code == 200
    assert schemas.json()["graph_id"] == "main_graph"
    assert schemas.json()["state_schema"] == {"type": "object"}


def test_delete_accepts_cascade_flag_without_checkpoint_dependency(
    client: TestClient,
) -> None:
    assistant_id = create_assistant(client)["assistant_id"]

    deleted = client.delete(f"/assistants/{assistant_id}?delete_threads=true")

    assert deleted.status_code == 200
    assert deleted.json() is None
    assert client.get(f"/assistants/{assistant_id}").status_code == 404
    assert client.delete(f"/assistants/{assistant_id}").status_code == 404


def test_invalid_uuid_is_validation_error(client: TestClient) -> None:
    assert client.get("/assistants/not-a-uuid").status_code == 422
    assert client.get("/assistants/not-a-uuid/subgraphs").status_code == 422


def test_versions_operation_has_no_request_body_in_openapi(client: TestClient) -> None:
    operation = cast(FastAPI, client.app).openapi()["paths"]["/assistants/{assistant_id}/versions"][
        "post"
    ]
    assert "requestBody" not in operation
