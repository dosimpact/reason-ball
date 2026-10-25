import json

import httpx
import pytest
from starlette.testclient import TestClient

from agent import history
from agent.app import app
from agent.dashboard import refresh, store


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def seeded(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    thread = history.create_thread("Refresh tests")["id"]
    state = store.execute(
        thread,
        {
            "action": "add",
            "panel_id": "p",
            "operation_id": "seed",
            "base_revision": 0,
            "payload": {
                "title": "Fixture only",
                "kind": "financial",
                "query": {
                    "cik": "1",
                    "metric": "revenue",
                    "years": 10,
                    "exclude_years": [2020],
                },
                "data": {"rows": [{"value": 10}]},
            },
        },
    )
    return thread, state


def request(revision=1, operation="refresh-1"):
    return {
        "action": "refresh",
        "panel_id": "p",
        "operation_id": operation,
        "base_revision": revision,
        "payload": {},
    }


@pytest.mark.anyio
async def test_refresh_uses_stored_query_and_deduplicates_retry(seeded, monkeypatch):
    thread, _ = seeded
    calls = []
    import asyncio

    connect = history.connect

    def nonblocking_connect():
        with pytest.raises(RuntimeError, match="no running event loop"):
            asyncio.get_running_loop()
        return connect()

    monkeypatch.setattr(history, "connect", nonblocking_connect)

    async def fetch(*args, **kwargs):
        calls.append((args, kwargs))
        return {"rows": [{"value": 12}], "latest_filing_date": "2026-01-01"}

    monkeypatch.setattr(refresh, "financials", fetch)
    updated = await refresh.refresh_panel(thread, request())
    panel = updated["panels"][0]
    assert panel["data"]["rows"][0]["value"] == 12
    assert panel["refresh"]["last_success_at"]
    assert panel["refresh"]["error"] is None
    assert calls == [(("1", "revenue", 10, [2020]), {"refresh": True})]
    assert await refresh.refresh_panel(thread, request()) == updated
    assert len(calls) == 1


@pytest.mark.anyio
async def test_failure_retains_data_and_records_safe_error(seeded, monkeypatch):
    thread, _ = seeded

    async def failed(*args, **kwargs):
        raise httpx.ConnectError("private request detail")

    monkeypatch.setattr(refresh, "financials", failed)
    result = await refresh.refresh_panel(thread, request())
    panel = result["panels"][0]
    assert panel["data"]["rows"] == [{"value": 10}]
    assert "ConnectError" in panel["refresh"]["error"]
    assert "private" not in json.dumps(result)
    assert panel["refresh"]["last_success_at"] is None


@pytest.mark.anyio
async def test_snapshot_refuses_network_and_content_update(seeded, monkeypatch):
    thread, _ = seeded
    store.execute(
        thread,
        {
            "action": "refresh_policy",
            "panel_id": "p",
            "operation_id": "freeze",
            "base_revision": 1,
            "payload": {"mode": "snapshot", "interval_seconds": 60},
        },
    )

    async def forbidden(*args, **kwargs):
        pytest.fail("Snapshot must not access SEC")

    monkeypatch.setattr(refresh, "financials", forbidden)
    with pytest.raises(ValueError, match="live"):
        await refresh.refresh_panel(thread, request(2))
    with pytest.raises(ValueError, match="Snapshot"):
        store.execute(
            thread,
            {
                "action": "update",
                "panel_id": "p",
                "operation_id": "change",
                "base_revision": 2,
                "payload": {"data": {"rows": [{"value": 99}]}},
            },
        )


@pytest.mark.anyio
async def test_freezing_during_query_rejects_late_result(seeded, monkeypatch):
    thread, _ = seeded

    async def fetch(*args, **kwargs):
        store.execute(
            thread,
            {
                "action": "refresh_policy",
                "panel_id": "p",
                "operation_id": "freeze",
                "base_revision": 1,
                "payload": {"mode": "snapshot"},
            },
        )
        return {"rows": [{"value": 99}]}

    monkeypatch.setattr(refresh, "financials", fetch)
    with pytest.raises(store.Conflict):
        await refresh.refresh_panel(thread, request())
    panel = store.read(thread)["panels"][0]
    assert panel["refresh"]["mode"] == "snapshot"
    assert panel["data"]["rows"] == [{"value": 10}]


def test_http_refresh_owns_result_and_rejects_caller_data(seeded, monkeypatch):
    thread, _ = seeded

    async def fetch(*args, **kwargs):
        return {"rows": [{"value": 12}]}

    monkeypatch.setattr(refresh, "financials", fetch)
    client = TestClient(app)
    url = "/dashboard/state/" + thread
    assert (
        client.post(
            url,
            json={
                **request(),
                "action": "refresh_result",
                "payload": {"data": {"rows": [{"value": 99}]}},
            },
        ).status_code
        == 400
    )
    assert (
        client.post(url, json={**request(), "payload": {"cik": "2"}}).status_code == 400
    )
    assert (
        client.post(url, json=request()).json()["panels"][0]["data"]["rows"][0]["value"]
        == 12
    )


def test_http_cooldown_preserves_last_success_without_network(seeded, monkeypatch):
    import time

    from agent.sec import client as sec_client

    thread, _ = seeded
    # A previously successful query remains the authoritative data after cooldown.
    store.execute(
        thread,
        {
            **request(),
            "operation_id": "prior-success",
            "action": "refresh_result",
            "payload": {
                "data": {"rows": [{"value": 12}]},
                "attempted_at": "2026-10-25T00:00:00+00:00",
            },
        },
    )
    before = store.read(thread)["panels"][0]
    monkeypatch.setenv("SEC_USER_AGENT", "test test@example.com")
    monkeypatch.setattr(sec_client, "_cooldown_until", time.monotonic() + 60)

    async def forbidden(*args, **kwargs):
        pytest.fail("Cooldown must prevent an outgoing HTTP request")

    monkeypatch.setattr(httpx.AsyncClient, "get", forbidden)
    client = TestClient(app)
    url = "/dashboard/state/" + thread
    response = client.post(url, json=request(2, "cooldown-attempt"))
    assert response.status_code == 200
    result = response.json()
    panel = result["panels"][0]
    assert panel["data"] == before["data"]
    assert panel["refresh"]["last_success_at"] == before["refresh"]["last_success_at"]
    assert "SEC 요청 대기" in panel["refresh"]["error"]
    assert "초 후" in panel["refresh"]["error"]
    assert panel["refresh"]["last_attempt_at"] != before["refresh"]["last_attempt_at"]
    assert (thread, "p") not in refresh._active
    # A network-free idempotent retry does not change revision or timestamps.
    assert client.post(url, json=request(2, "cooldown-attempt")).json() == result
