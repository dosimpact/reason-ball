from fastapi.testclient import TestClient

from langgraph_fast.server.server import app


def test_health() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_graph_run_uses_workflow(monkeypatch) -> None:
    async def fake_run_graph(message: str, provider_name: str = "openai"):
        return {
            "message": message,
            "provider": provider_name,
            "response": "fake response",
        }

    monkeypatch.setattr("langgraph_fast.server.server.run_graph", fake_run_graph)
    client = TestClient(app)

    response = client.post(
        "/graph/run",
        json={"message": "hello", "provider": "openai"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "hello",
        "provider": "openai",
        "response": "fake response",
    }
