from pathlib import Path

from fastapi.testclient import TestClient

from server.server import app

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "tenk" / "sample_10k.txt"


def test_tenk_parse_file_dry_run() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/tenk/parse-file",
        json={
            "path": str(FIXTURE),
            "company_name": "Sample Technology Inc.",
            "ticker": "SAMP",
            "report_type": "10-K",
            "dry_run": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["segments"] == 4
    assert payload["graph_nodes"] > 0
    assert payload["written_nodes"] == 0


def test_tenk_parse_file_rejects_missing_metadata_json() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/tenk/parse-file",
        json={"path": str(FIXTURE), "metadata_json": "/tmp/does-not-exist.json", "dry_run": True},
    )

    assert response.status_code == 400
    assert "metadata_json not found" in response.json()["detail"]
