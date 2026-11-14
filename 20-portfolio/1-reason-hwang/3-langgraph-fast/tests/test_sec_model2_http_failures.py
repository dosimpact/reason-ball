"""SEC-VAL-104: isolated HTTP fixtures never connect to the user's graph."""

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from domains.sec_modeling import runtime
from server.routers import sec_modeling


@pytest.mark.parametrize(
    "failure",
    [
        ValueError("Malformed extraction"),
        RuntimeError("provider secret must not leak"),
        InterruptedError("Execution cancelled"),
    ],
)
def test_failed_rebuild_keeps_prior_publication(monkeypatch, failure):
    active = {
        "id": "previous-publication",
        "sourceHash": "hash",
        "inputGenerationId": "model1",
    }
    runs = {}

    class IsolatedStore:
        def initialize(self):
            pass

        def close(self):
            pass

        def run_state(self, run_id):
            return runs.get(run_id, {"status": "UNKNOWN"})

        def claim(self, run_id, token):
            runs[run_id] = {"status": "RUNNING", "executionToken": token}

        def finish_failed(self, run_id, token, status, code):
            assert runs[run_id]["executionToken"] == token
            runs[run_id].update(status=status, errorCode=code)

        def active(self, filing, stage):
            return active if stage == 2 else {"id": "model1"}

        def records(self, generation):
            assert generation == active["id"]
            return [{"id": "old-evidence", "text": "previous successful result"}]

        def publish(self, *args):
            raise AssertionError("Failed build must not publish")

    def failed_build(*args):
        raise failure

    monkeypatch.setenv("SEC_MODELING_KEY", "fixture-only")
    monkeypatch.setattr(runtime, "GraphStore", IsolatedStore)
    monkeypatch.setattr(sec_modeling, "GraphStore", IsolatedStore)
    monkeypatch.setattr("domains.sec_modeling.model2.build_lexical", failed_build)
    app = FastAPI()
    app.include_router(sec_modeling.router)
    prefix = "/internal/sec-modeling/filings/0000320193/0000320193-26-000026"
    with TestClient(app, headers={"X-SEC-Modeling-Key": "fixture-only"}) as client:
        prior = client.get(prefix + "/results/2").json()
        response = client.post(
            "/internal/sec-modeling/model-2/runs",
            json={
                "runId": "fixture-failure",
                "executionToken": "fixture-token",
                "cik": "0000320193",
                "accessionNo": "0000320193-26-000026",
                "inputGenerationId": "model1",
            },
        )
        assert response.status_code == 200
        events = [json.loads(line) for line in response.text.splitlines()]
        assert events[-1]["type"] == "error"
        assert not any(e["type"] == "completed" for e in events)
        assert "secret" not in response.text
        state = client.get("/internal/sec-modeling/runs/fixture-failure").json()
        assert state["status"] == (
            "CANCELLED" if isinstance(failure, InterruptedError) else "FAILED"
        )
        assert "executionToken" not in state
        assert client.get(prefix + "/results/2").json() == prior
        assert (
            client.get(prefix + "/status").json()["stages"]["2"]["id"] == active["id"]
        )
