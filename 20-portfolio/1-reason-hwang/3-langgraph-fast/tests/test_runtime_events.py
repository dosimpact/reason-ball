from unittest.mock import AsyncMock

import pytest

from infrastructure.postgres.runtime_events import RuntimeEvents, RuntimeEventTooLarge


@pytest.mark.asyncio
async def test_terminal_retention_expiry_returns_durable_result():
    events = RuntimeEvents(None, "test")
    events.read = AsyncMock(
        return_value={
            "run": {
                "internal_status": "terminal",
                "result": {"secret": "not replayed"},
            },
            "events": [],
            "gap": True,
            "oldestCursor": 8,
            "latestCursor": 7,
        }
    )
    frames = [frame async for frame in events.stream("run")]
    assert "event: metadata" in frames[0]
    assert "event: values" in frames[1]
    assert "event: end" in frames[2]
    assert "secret" in frames[1]


@pytest.mark.asyncio
async def test_stream_preserves_durable_sequence_and_namespace_event():
    events = RuntimeEvents(None, "test")
    events.read = AsyncMock(
        return_value={
            "run": {"internal_status": "terminal"},
            "events": [
                {"sequence": 4, "event": "custom|child", "payload": {"ready": True}},
                {"sequence": 5, "event": "end", "payload": {}},
            ],
            "gap": False,
            "oldestCursor": 1,
            "latestCursor": 5,
        }
    )
    frames = [frame async for frame in events.stream("run", cursor=3)]
    assert len(frames) == 3
    assert "id: 4\nevent: custom|child" in frames[1]
    events.read.assert_awaited_once_with("run", 3)


@pytest.mark.asyncio
async def test_oversized_event_fails_before_database_mutation():
    events = RuntimeEvents(None, "test", max_event_bytes=3)
    conn = AsyncMock()
    with pytest.raises(RuntimeEventTooLarge):
        await events.append_locked(conn, "run", 1, [("values", "long")])
    conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_running_gap_stops_before_partial_canvas_delta():
    events = RuntimeEvents(None, "test")
    events.read = AsyncMock(
        return_value={
            "run": {"internal_status": "running"},
            "events": [
                {
                    "sequence": 7,
                    "event": "custom",
                    "payload": {"delta": "unsafe suffix"},
                }
            ],
            "gap": True,
            "oldestCursor": 7,
            "latestCursor": 7,
        }
    )
    frames = [frame async for frame in events.stream("run", cursor=2)]
    assert "event: error" in frames[1] and "stream_buffer_gap" in frames[1]
    assert "event: end" in frames[2]
    assert "unsafe suffix" not in "".join(frames)


def running_page():
    return {
        "run": {"internal_status": "running"},
        "events": [],
        "gap": False,
        "oldestCursor": 1,
        "latestCursor": 0,
    }


def terminal_page():
    return {
        "run": {"internal_status": "terminal", "result": {}},
        "events": [],
        "gap": False,
        "oldestCursor": 1,
        "latestCursor": 0,
    }


@pytest.mark.asyncio
async def test_commit_hint_during_database_read_is_not_lost():
    import asyncio

    events = RuntimeEvents(None, "test", poll_seconds=10)

    async def read(*args):
        if events.read.await_count == 1:
            events.notify("run")
            return running_page()
        return terminal_page()

    events.read = AsyncMock(side_effect=read)
    frames = await asyncio.wait_for(_collect(events.stream("run")), 0.2)
    assert any("event: values" in frame for frame in frames)
    assert events.read.await_count == 2
    assert events._subscriptions == {}


async def _collect(stream):
    return [frame async for frame in stream]


@pytest.mark.asyncio
async def test_close_releases_all_shared_run_waiters_and_cleans_subscriptions():
    import asyncio

    events = RuntimeEvents(None, "test", poll_seconds=10)
    events.read = AsyncMock(return_value=running_page())
    left, right = events.stream("run"), events.stream("run")
    await anext(left)
    await anext(right)
    tasks = [asyncio.create_task(anext(stream)) for stream in (left, right)]
    while events.read.await_count < 2:
        await asyncio.sleep(0)
    assert events._subscriptions["run"].users == 2
    events.close()
    results = await asyncio.wait_for(
        asyncio.gather(*tasks, return_exceptions=True), 0.2
    )
    assert all(isinstance(result, StopAsyncIteration) for result in results)
    assert events._subscriptions == {}


@pytest.mark.asyncio
async def test_listener_reconnect_wakes_current_subscribers_without_spurious_entries():
    import asyncio

    events = RuntimeEvents(None, "test", poll_seconds=10)
    events.read = AsyncMock(side_effect=[running_page(), terminal_page()])
    stream = events.stream("run")
    await anext(stream)
    pending = asyncio.create_task(anext(stream))
    while events.read.await_count < 1:
        await asyncio.sleep(0)
    events.notify("unsubscribed-run")
    assert "unsubscribed-run" not in events._subscriptions
    events.notify_all()
    assert "event: values" in await asyncio.wait_for(pending, 0.2)
    await stream.aclose()
    assert events._subscriptions == {}
