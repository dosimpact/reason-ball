from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "x-request-id" in response.headers


def test_create_and_get_item() -> None:
    create_response = client.post("/items", json={"name": "monitor", "price": 199000})

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "monitor"

    get_response = client.get(f"/items/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json() == created


def test_metrics_endpoint() -> None:
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "http_requests_total" in response.text

