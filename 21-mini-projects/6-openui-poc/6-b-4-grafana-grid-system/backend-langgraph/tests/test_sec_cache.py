"""SEC cache reuse and request suppression, without contacting SEC."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from email.utils import format_datetime
from itertools import pairwise

import httpx
import pytest

from agent.sec import client, storage, tools

URL = "https://data.sec.gov/submissions/CIK0000000001.json"


@pytest.fixture(autouse=True)
def isolated(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SEC_USER_AGENT", "Fixture test@example.com")
    monkeypatch.setattr(client, "_gate", asyncio.Lock())
    monkeypatch.setattr(client, "_last_request", 0.0)
    monkeypatch.setattr(client, "_cooldown_until", 0.0)
    monkeypatch.setattr(client, "_inflight", {})
    monkeypatch.setattr(client, "REQUEST_INTERVAL", 0.0)


def transport(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        client.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )


def test_concurrent_requests_and_later_read_use_one_download(monkeypatch):
    calls = []

    async def handler(request):
        calls.append(request.url)
        assert request.headers["User-Agent"] == "Fixture test@example.com"
        assert request.headers["Accept"] == "application/json, text/plain, */*"
        await asyncio.sleep(0.03)
        return httpx.Response(200, json={"version": len(calls)})

    transport(monkeypatch, handler)

    async def scenario():
        rows = await asyncio.gather(*(client.fetch(URL) for _ in range(12)))
        assert rows == [{"version": 1}] * 12
        assert await client.fetch(URL) == {"version": 1}
        assert len(calls) == 1
        rows = await asyncio.gather(*(client.fetch(URL, max_age=0) for _ in range(5)))
        assert rows == [{"version": 2}] * 5
        assert len(calls) == 2

    asyncio.run(scenario())
    assert json.loads(storage.cached(URL, 3600)) == {"version": 2}


def test_one_cancelled_waiter_does_not_cancel_shared_download(monkeypatch):
    async def scenario():
        entered, release = asyncio.Event(), asyncio.Event()
        calls = []

        async def handler(request):
            calls.append(request.url)
            entered.set()
            await release.wait()
            return httpx.Response(200, json={"saved": True})

        transport(monkeypatch, handler)
        first = asyncio.create_task(client.fetch(URL))
        await entered.wait()
        second = asyncio.create_task(client.fetch(URL))
        first.cancel()
        with pytest.raises(asyncio.CancelledError):
            await first
        release.set()
        assert await second == {"saved": True}
        assert len(calls) == 1

    asyncio.run(scenario())


@pytest.mark.parametrize("status", [403, 429, 503])
def test_cooldown_blocks_other_urls_but_cached_data_stays_usable(monkeypatch, status):
    calls = []

    def handler(request):
        calls.append(request.url)
        return httpx.Response(status, headers={"Retry-After": "120"})

    transport(monkeypatch, handler)
    cached_url = "https://www.sec.gov/files/company_tickers.json"
    storage.cache(cached_url, '{"cached": true}')

    async def scenario():
        with pytest.raises(httpx.HTTPStatusError):
            await client.fetch(URL)
        with pytest.raises(client.SecCooldownError) as error:
            await client.fetch(URL + "?other=1")
        assert 115 <= error.value.retry_after <= 120
        assert await client.fetch(cached_url) == {"cached": True}
        assert len(calls) == 1
        result = json.loads(await tools.safely(client.fetch(URL)))
        assert result["error"] == "SEC_COOLDOWN"
        assert result["retry_after_seconds"] > 0

    asyncio.run(scenario())
    assert storage.cached(URL, 3600) is None


def test_invalid_refresh_does_not_replace_valid_cache(monkeypatch):
    storage.cache(URL, '{"original": true}')
    transport(monkeypatch, lambda request: httpx.Response(200, text="bad json"))
    with pytest.raises(json.JSONDecodeError):
        asyncio.run(client.fetch(URL, max_age=0))
    assert json.loads(storage.cached(URL, 3600)) == {"original": True}


def test_retry_after_seconds_and_http_date():
    assert client.retry_after_seconds("120") == 120
    assert client.retry_after_seconds("nonsense") == 0
    assert client.retry_after_seconds("NaN") == 0
    later = format_datetime(datetime.now(UTC) + timedelta(seconds=90), usegmt=True)
    assert 88 <= client.retry_after_seconds(later) <= 90


def test_requests_are_serialized_and_spaced(monkeypatch):
    monkeypatch.setattr(client, "REQUEST_INTERVAL", 0.02)
    starts = []
    active = 0

    async def handler(request):
        nonlocal active
        assert active == 0
        active += 1
        starts.append(asyncio.get_running_loop().time())
        await asyncio.sleep(0.005)
        active -= 1
        return httpx.Response(200, json={})

    transport(monkeypatch, handler)

    async def scenario():
        await asyncio.gather(*(client.fetch(URL + f"?id={i}") for i in range(3)))

    asyncio.run(scenario())
    assert len(starts) == 3
    assert all(b - a >= 0.018 for a, b in pairwise(starts))
