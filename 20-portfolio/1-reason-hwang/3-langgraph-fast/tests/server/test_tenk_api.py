"""The legacy arbitrary-local-file parser is no longer exposed."""
from fastapi.testclient import TestClient

from server.server import app


def test_legacy_parser_is_removed():
    response = TestClient(app).post("/api/tenk/parse-file", json={"path": "/tmp/example.htm", "dry_run": True})
    assert response.status_code == 404
